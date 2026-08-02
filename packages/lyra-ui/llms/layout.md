## `lr-split`

Resizable panels for dashboard layouts. Direct **light-DOM children are the panels**; a divider is
auto-inserted between each adjacent pair.

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
  entry is a length string, every entry is resolved against the measured container (numbers as
  percent-of-container, `%` as-is, `px`/`rem`/`em` via the shared length resolver) and then
  normalized to percentages before the same validation applies — so `['200px', '300px']` on a 500px
  container initializes to `[40, 60]`.
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
  Inside a media query, relative units resolve against the browser's *initial* font size and ignore
  any `html { font-size }` override; under `'container'` they resolve against live computed font
  sizes. The two agree unless an app re-points the root font size. So when the breakpoint must stay
  in lockstep with a CSS `@media` rule, `'viewport'` is the exact match — the browser evaluates the
  same query, live, across browser zoom and user font-size preferences, with no px re-derivation.
- `narrowOrientation: 'horizontal'|'vertical' = 'vertical'` (reflected, attribute `narrow-orientation`)
- `effectiveOrientation: 'horizontal'|'vertical'` (readonly getter) — the live resize/layout axis
  actually in effect; identical to `orientation` whenever `orientationBreakpoint` is unset or
  doesn't resolve to a length. Also reflected as `data-effective-orientation` (only present while
  `orientationBreakpoint` resolves to a usable length).
- `storageKey?: string` (attribute `storage-key` — persists sizes to `localStorage` under
  `` `lr-split:${key}:${panelCount}` ``, scoped by panel count so a stale layout for a different
  panel count is ignored)
- `panelConstraints: (PanelConstraint | null)[] = []` (attribute: false) — `PanelConstraint { minPx?:
  number; maxPx?: number; minPercent?: number; maxPercent?: number }`, index-aligned with `sizes`; a
  `null`/missing entry (or an omitted bound within an entry) leaves that side of that panel purely
  percent-based (the existing `min`-only behavior). Combining a px and a percent bound on the same
  side resolves to the stricter one (larger for min, smaller for max) via a native CSS `max()`/`min()`
  in the rendered `clamp()` flex-basis. `sizes`, the `lr-resize` payload, and localStorage persistence
  stay percent-based regardless — only the effective drag/keyboard clamp bounds (and the rendered
  `flex-basis`, via a native CSS `clamp()` so a constrained panel stays pinned between its bounds
  across container resizes with no extra `ResizeObserver`) change for a constrained panel.
- `collapse: 'start'|'end'|'none' = 'none'` (reflected) — opt-in responsive collapse for one panel:
  `'start'`/`'end'` is a *logical* position (RTL-aware, matching CSS logical properties — the panel at
  the document's visual leading/trailing edge, not a raw array index). `lr-split` only owns the
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
  `rem` breakpoint with real `@media` semantics (against the *initial* font size, ignoring an
  `html { font-size }` override). Both bands are classified from both queries together on every
  change, so a fast resize crossing both thresholds at once still lands on one correct state and
  fires `lr-split-collapse-change` once; under `'viewport'` the first paint is already correct — no
  `ResizeObserver` round-trip — and that initial state is not announced as a transition.
- `collapseState: 'wide'|'rail'|'floating'` (reflected, attribute `collapse-state`) — a public
  accessor with force/auto semantics mirroring `<lr-app-rail>`'s `mode`: normally derived
  automatically from the measured container width, but assigning it a concrete value pins it there
  (stopping automatic breakpoint tracking) — useful for a consumer-driven toggle (e.g. a button that
  forces `'floating'` regardless of width). Assigning the write-only `'auto'` sentinel releases the
  pin and immediately re-derives the state from the current measured width; the getter never returns
  `'auto'`.
- `open: boolean = false` (reflected) — whether the `'floating'` collapse state's drawer is shown.
  While `collapseState` is `'floating'` and `open` is `false` (the default), the collapsing panel
  renders nothing (`hidden`, out of the accessibility tree) instead of the always-visible overlay
  card this state rendered before `open` existed. Setting `open = true` reveals it as a
  focus-trapped floating panel with a `[part="backdrop"]` scrim; Escape or a backdrop click set
  `open` back to `false`. Leaving `'floating'` while `open` is still `true` also closes it, the same
  way `<lr-app-rail>` closes its mobile overlay when leaving `'mobile'` while open.

`collapse`'s three resulting states — `'wide'` (default, today's plain layout) / `'rail'` / `'floating'`
— are exposed as: a `data-collapse-state` attribute on both the host and the collapsing panel element
itself (absent for `'wide'`/`collapse="none"`); and the `lr-split-collapse-change` event below. The
divider adjacent to the collapsed panel is drag/keyboard-disabled (`aria-disabled="true"`) while
collapsed. `collapse="none"` (the default) is byte-for-byte identical to pre-collapse-feature behavior.

`dividerLabel?: (index: number, panelCount: number) => string` (attribute: false) customizes the
localized accessible label generated for each auto-inserted divider.

**Events:** `lr-resize` (`detail: { sizes }`, fired on every drag step/release **and** every
keyboard step), `lr-split-collapse-change` (`detail: { state: 'wide'|'rail'|'floating' }`, fired only
on a real `collapse`-state transition, never on every resize/render),
`lr-split-constraints-invalid` (`detail: SplitConstraintIssueDetail`, fired once when the configured
panel minimums/maximums cannot fit the track; the infeasible set is rejected for interaction and a
normalized percent minimum is used instead), `lr-split-orientation-change` (`detail: { orientation }`,
fired only when an enabled `orientationBreakpoint` actually changes `effectiveOrientation`)

**Slots:** default (each direct child element is one panel).

**CSS parts:** `base` (`position: relative`, so the `'floating'` state can anchor to it), `divider`
(carries `aria-disabled="true"` and is drag/keyboard-inert while its adjacent panel is collapsed),
`backdrop` (the `'floating'` drawer's scrim — only rendered while `collapseState === 'floating'` and
`open`)

**Themeable custom properties:** `--lr-split-overlay-color` (default `var(--lr-color-overlay)`) —
the `'floating'` drawer's `[part='backdrop']` scrim; scoped to `[part='base']`, not the viewport.
`--lr-split-divider-hit-slop` (default `calc((var(--lr-size-3px) - var(--lr-icon-button-size)) / 2)`,
i.e. `-18.5px` at the shipped token values) — the per-side inset of `[part='divider']`'s invisible
`::before` hit area along the resize axis. It is negative on purpose: the `::before` box extends past
the divider's own edges so the *effective* pointer/touch target reaches the shared
`--lr-icon-button-size` WCAG 2.5.8 floor (40px) while the divider anyone can see stays 3px. Unlike
most properties here it is **declared on `:host`**, so an override has to target the element itself —
an ancestor rule is shadowed. Overriding it directly is rarely the right move: retheme
`--lr-size-3px` or `--lr-icon-button-size` and the slop recomputes to keep exactly closing the gap.
Otherwise shared tokens only.

**Optional peer deps:** none.

```html
<lr-split storage-key="dashboard-main" min="15">
  <div>Panel A</div>
  <div>Panel B</div>
  <div>Panel C</div>
</lr-split>
```

Keyboard: focus a divider (`Tab`), then `ArrowRight`/`ArrowLeft` (horizontal) or
`ArrowDown`/`ArrowUp` (vertical) to resize by a fixed 2% step — RTL-aware for horizontal layouts
(under `direction: rtl`, the forward/backward keys and drag-delta sign both swap so they still track
the visually-adjacent panel).

**Known gotchas:**
- `panelCount` now reacts to `slotchange` (not just the initial `connectedCallback()` read), and
  `ensureSizes()` rebalances existing sizes proportionally when a panel is added or removed after
  mount instead of discarding the whole layout — a conditionally-shown side panel no longer leaves
  `panelCount`/`sizes`/divider count stale.
- divider `aria-valuemax` is now computed per adjacent pair (`sizes[i] + sizes[i+1] - min`) rather
  than a blanket `100 - min`, so it's accurate for 3+-panel layouts too, not just exactly two panels
  — this formula still only accounts for the plain percent `min`, though: with `panelConstraints`
  set, a panel's real achievable range can be narrower (or expressed in px) than what
  `aria-valuemin`/`aria-valuemax` report. Each divider also now has its own `aria-label` ("Resize
  divider between panel N and panel N+1") distinguishing it from any other divider in a
  multi-divider layout.
- infeasible aggregate constraints (for example, three panels with `min=40`) are reported through
  `lr-split-constraints-invalid`; interaction rejects that set and uses a normalized percent minimum
  with aggregate slack, so the divider remains operable instead of silently freezing.
- concurrent drags are tracked per `pointerId` (not a single scalar), so a multi-touch drag on two
  different dividers moves both independently instead of the second pointer clobbering the first's
  drag state; `pointercancel`/`lostpointercapture` (not just `pointerup`) both end a drag.
- `localStorage.getItem`/`setItem` calls are now both wrapped in their own `try`/`catch` (in addition
  to the `JSON.parse` result already being caught), so a blocked or quota-exceeded store fails
  silently instead of throwing from inside a `pointerup`/`keydown` handler. A persisted layout whose
  panel count no longer matches, or whose sizes are already below the current `min` floor, is
  rejected rather than restored.
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
  re-derives from the current measured width. Collapse's basis changes only *which values* the
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
  to the *full* row width — wider than it was just before the transition. Because the measured width
  is not monotonic across that transition, no single container threshold both stays wide while the
  row is a row and goes narrow exactly when it stacks. A fixed-width sibling is worse still: its own
  width never changes with the viewport at all, so no container breakpoint on it can react to the
  stacking.
  That layout is what `orientationBreakpointBasis='viewport'` is for. Give every sibling the same
  `orientation-breakpoint` and `orientation-breakpoint-basis='viewport'` and they flip together, in
  lockstep with the CSS rule that stacks the row:
  ```html
  <lr-stepper orientation-breakpoint="56.25rem" orientation-breakpoint-basis="viewport"></lr-stepper>
  <lr-split   orientation-breakpoint="56.25rem" orientation-breakpoint-basis="viewport"></lr-split>
  <style>@media (max-width: 56.25rem) { .shell { flex-direction: column; } }</style>
  ```
  A consumer-side `matchMedia()` controller driving the `orientation` attribute directly is still
  supported and still correct — it is simply no longer required for this case.

---

## `lr-split-panel`

Accessible two-pane resizing with the public `wa-split-panel` / `sl-split-panel` contract. Use this
component when migrated markup has named `start` and `end` panes. The separate `<lr-split>` is
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
  pixels, percentages, and repeat expressions (`'160px 50% repeat(100px)'`). A property-bound
  `SnapFunction` receives `{ pos, size, snapThreshold }` in pixels and returns the desired pixel
  position; callback code decides how to use the supplied threshold. The setter also accepts
  `undefined` for mapped source compatibility, clearing the configuration to the canonical `''`
  read value.
- `snapThreshold: number = 12` (attribute `snap-threshold`) — maximum pixel distance at which a
  string snap point takes effect. Non-finite values fall back safely and negative values clamp to
  zero.

**Events:** `lr-reposition` (no detail) — bubbling and composed, emitted whenever pointer or
keyboard interaction changes the divider position.

**Slots:** `start` (logical start pane), `end` (logical end pane), `divider` (optional custom handle
content inside the separator). Under RTL, logical start/end and horizontal pointer/arrow behavior
mirror together; vertical behavior does not invert.

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

Keyboard: focus the divider, then use Left/Right for a horizontal split or Up/Down for a vertical
split. Each arrow moves one percent of the current allocation; horizontal arrows mirror under RTL.
`Home` and `End` move to the current `--min` and `--max` bounds. Pointer dragging uses capture and
cleans up on pointer up, cancellation, capture loss, disconnect, and orientation changes.

**Optional peer deps:** none.

```js
import '@aceshooting/lyra-ui/components/layout/split-panel/split-panel.js';
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
  `[part="base"]` and `[part="backdrop"]` while fullscreen instead of the default per-side
  `max(var(--lr-space-l), <safe-area inset>)`, e.g. `"0 0 0 240px"` to leave a 240px persistent
  sidebar/toolbar visible during fullscreen. Invalid values, declaration-breaking input, and
  `url()` are ignored.
- `compact: boolean = false` (reflected) — tighter header/body padding, same convention as
  `lr-empty`'s `compact`
- `backdropInset: string = ''` (attribute `backdrop-inset`) — overrides the fullscreen backdrop's
  CSS `inset` independently from `fullscreenInset`; when empty or invalid, it follows a valid
  `fullscreenInset`
- `views: WidgetView[] = []` (attribute: false) — named alternate views for the panel body, e.g. a
  chart/table toggle inside the same card chrome; `WidgetView { id: string; label?: string; icon?:
  TemplateResult; ariaLabel?: string }`. Each entry gets a header toggle button
  (`[part='view-toggle']`) and a `<slot name="view-${id}">`. An icon-only view should set
  `ariaLabel`; if both labels are omitted, the button uses `id` as a last-resort accessible name.
  Empty (the default) renders today's single unnamed default slot as the sole view, unchanged.
- `activeView: string = ''` (attribute: false) — the currently active view's `id`; defaults to the
  first entry of `views` (or `''` when `views` is empty). Settable directly to control the active
  view externally; also updated internally when a view toggle is clicked.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the label-derived
  fullscreen dialog name.
- `storageKey?: string` (attribute `storage-key`) — when set, persists `collapsed` to `localStorage`
  under `lr-widget:${storageKey}` and restores it on the next mount (mirrors `lr-app-rail`'s/
  `lr-table`'s identical `storage-key` pattern). Without a `storageKey` there is no persistence and
  storage is never touched — listen for `lr-collapse-change` and persist the state yourself.

**Events:** `lr-collapse-change` (`detail: { collapsed }`, the new state), `lr-fullscreen-change`
(`detail: { fullscreen }` — also fired when fullscreen is exited via Escape or a backdrop click, not
just the toggle button), `lr-view-change` (`detail: { viewId }`, the new active view's `id` — fired
when it changes via a header view-toggle click, not when a consumer sets `activeView` directly)

**Slots:** default (the panel body, rendered only while `views` is empty), `icon` (optional leading
icon in the title row), `label` (rich label content, overrides the `label` attribute), `sublabel`
(rich sublabel content, overrides the `sublabel` attribute), `actions` (header action controls,
rendered before the collapse/expand buttons), `collapse-icon` (replaces the built-in chevron in the
collapse toggle via native slot fallback; only meaningful while `collapsible`), `fullscreen-icon`
(replaces the built-in glyph in the fullscreen toggle — the override replaces *both* the "expand"
and "exit fullscreen" defaults, so the consumer owns that distinction, e.g. by reading the
`fullscreen` attribute; only meaningful while `expandable`), and one `view-{id}` slot per `views`
entry, used instead of the default slot

**CSS parts:** `base`, `header`, `title`, `icon` (wrapper around the `icon` slot, hidden entirely when
empty), `label-group` (wrapper around the label and sublabel), `label`, `sublabel`, `actions`,
`view-toggles` (the header toggle-button group, only rendered when `views` is non-empty),
`view-toggle` (a single view toggle button), `collapse-button`, `fullscreen-button`, `body`,
`backdrop`

**Themeable custom properties:** `--lr-widget-overlay-color` (default `var(--lr-color-overlay)` —
the fullscreen backdrop scrim color), `--lr-widget-fullscreen-inset` (default per side
`max(var(--lr-space-l), <safe-area inset>)` — the fullscreen `[part="base"]` inset; the
`fullscreen-inset` attribute overrides it), and `--lr-widget-backdrop-inset` (defaults to
`var(--lr-widget-fullscreen-inset)`; the `backdrop-inset` attribute overrides it), plus shared
tokens (`--lr-space-*`, `--lr-color-border/-surface/-text-quiet`,
`--lr-radius`, `--lr-shadow`, `--lr-icon-button-size`, `--lr-focus-ring-*`).

Two further properties style the pressed view toggle: `--lr-widget-view-toggle-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-widget-view-toggle-active-color` (default
`var(--lr-color-brand)`) — the background and text color of the `aria-pressed="true"` toggle. Both
are **state hooks**: declared as inline `var()` fallbacks at the point of use and never on `:host`,
so setting either on the element *or on any ancestor* reaches the toggle. That shape exists because
`::part(view-toggle)[aria-pressed='true']` is not valid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so before these hooks the only way to recolor an active toggle was to
override the library-wide `--lr-color-brand-quiet`/`--lr-color-brand` tokens, repainting every other
element that reads them. Left unset, each falls back to exactly the token the rule used before, so
rendering is unchanged.

`--lr-widget-view-toggle-hover-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-widget-view-toggle-hover-color` (default `var(--lr-color-text)`) are the same shape for the
*hover* state, and the `:hover` rule wraps its selector in `:where()` so a consumer's own
`::part(view-toggle):hover` override wins without `!important`.

**Optional peer deps:** none.

```html
<lr-widget label="Load profile" sublabel="Last 7 days" collapsible expandable>
  <span slot="actions"><button>Refresh</button></span>
  <div>Panel body content — a chart, a table, anything.</div>
</lr-widget>
```

While `fullscreen`, `[part="base"]` (not the host itself) takes `role="dialog"` + `aria-modal="true"`
(with `aria-label` from `label`, falling back to `"Fullscreen panel"`), document scroll is locked
(ref-counted, safe with multiple simultaneously-fullscreen widgets), and Tab/Shift+Tab are bounded
to the panel's own focusable content (`actions` slot → collapse/fullscreen buttons → body slot,
matching visual tab order — resolved shadow-piercingly, so a slotted custom element's real
focusable target inside its own shadow root is found too) so keyboard focus can't escape to page
content hidden behind the backdrop. Escape or clicking the backdrop exits fullscreen and returns
focus to whichever button triggered it. Set `fullscreen-inset` (e.g. `"0 0 0 240px"`) to reserve
space for a persistent sidebar/toolbar that should stay visible instead of being covered by the
fullscreen panel/backdrop — it overrides the default `var(--lr-space-l)` inset on every side for
both `[part="base"]` and `[part="backdrop"]`. Set `compact` for tighter header/body padding.

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
`<lr-carousel-item>` wins over generated metadata.

**Properties:**
- `currentSlide: number = 0` (attribute `current-slide`, reflected) — zero-based index of the first
  slide in the active page. `index: number = 0` (attribute `index`, reflected) is the established
  Lyra alias; setting either name updates and reflects both through one clamped state value.
- `loop: boolean = false` (attribute `loop`, reflected) — wraps navigation at either end
- `autoplay: boolean = false` (attribute `autoplay`, reflected) and
  `autoplayInterval: number = 3000` (attribute `autoplay-interval`) — optional timed advance.
  Autoplay pauses while the page is hidden or the user is hovering, focusing, or dragging the
  carousel, and remains off under `prefers-reduced-motion: reduce`.
- `navigation: boolean = false` (attribute `navigation`, reflected) — renders previous and next
  buttons
- `pagination: boolean = false` (attribute `pagination`, reflected) — renders page indicators.
  `showIndicators: boolean = false` (attribute `show-indicators`) is the synchronized Lyra alias;
  its legacy literal `show-indicators="false"` spelling remains understood.
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
- `slides: number = 0` (attribute `slides`, reflected) — live assigned-slide count; updated after
  dynamic child changes
- `accessibleLabel: string = ''` (attribute `accessible-label`) — fallback landmark name; a host
  `aria-label` takes precedence

**8.0 default migration:** navigation and pagination now match the mapped opt-in defaults. Markup
that relied on Lyra's former always-present arrow row or `showIndicators = true` must add
`navigation` and/or `pagination`; the `showIndicators` property/attribute remains an alias but now
defaults to `false`. The autoplay interval also changes from Lyra's former 5000ms to the mapped
3000ms default. Existing explicit values continue to win.

**Methods:**
- `next(behavior: ScrollBehavior = 'smooth')` and
  `previous(behavior: ScrollBehavior = 'smooth')` move by `slidesPerMove`
- `goToSlide(index, behavior: ScrollBehavior = 'smooth')` moves to a specific slide;
  `goTo(index, behavior)` is the Lyra compatibility alias
- `addSlide(slide: LyraCarouselItem)` appends a slide and `removeSlide(index)` removes one; page
  count, reflected `slides`, active range, inertness, loop endcaps, and pagination reconcile
  automatically

**Events:** `lr-slide-change` (`detail: { index, slide }`) — emitted after the active slide changes
from a method, button, key, pagination item, autoplay tick, or settled user scroll. `slide` is the
original assigned element at `index`, never a loop endcap.

**Paging and scrolling.** The page count is the set of reachable starts from zero to
`slideCount - slidesPerPage`, stepping by `slidesPerMove` and always including the final start. All
slides in the active page are restored to their authored `inert`/`aria-hidden` state; every other
slide keeps its layout box but becomes `inert` and `aria-hidden="true"`, so visible multi-slide
pages remain fully operable while off-page links are unreachable. Native mandatory scroll snap
owns touch, trackpad, momentum, and rubber-band behavior. Settling adopts the nearest page once and
emits one event for the whole gesture. Programmatic movement scrolls the same track; first mount
and reduced-motion alignment are instant. Loop mode adds inert, accessibility-hidden endcaps so
forward/backward wrapping continues in the requested direction, then silently resets to the
matching original slide. Clone idrefs and form-identifying attributes are not duplicated.

Horizontal Left/Right keys follow logical direction and swap under RTL; vertical carousels use
Up/Down without an RTL inversion. Home and End move to the first and final reachable start. The
populated multi-slide state remains accessible at a 320px allocation.

**Slots:** default slides, `previous-icon`, and `next-icon`. Named icon slots replace only the
decorative glyph content; Lyra retains the localized button names and minimum hit areas.

**CSS parts:** `base carousel` (same region node), `scroll-container viewport` (same focusable
scroll port), `navigation`, `navigation-button`, `navigation-button-previous` /
`navigation-button-next`, Shoelace aliases `navigation-button--previous` /
`navigation-button--next`, and Lyra aliases `previous-button` / `next-button` plus
`previous-glyph` / `next-glyph`; `pagination indicators`, `pagination-item indicator`, active
aliases `pagination-item-active` / `pagination-item--active`, and `indicator-dot`. `track` and
`controls` are Lyra extensions.

**Themeable custom properties:** mapped `--aspect-ratio` (default `16/9`), `--scroll-hint`
(logical scroll-area padding), and `--slide-gap` (default `var(--lr-space-m)`). Lyra extensions
`--lr-carousel-indicator-current-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-carousel-indicator-current-border-color` (default `var(--lr-color-brand)`) color only the
active `indicator-dot`. `--lr-carousel-slide-basis` remains a compatibility escape hatch that
overrides the basis computed from `slidesPerPage`; prefer the property for normal multi-slide
layouts because it also updates paging and accessibility state.

```html
<lr-carousel navigation pagination aria-label="Screenshots">
  <lr-carousel-item><img alt="Dashboard overview" src="overview.png"></lr-carousel-item>
  <lr-carousel-item><img alt="Dashboard details" src="details.png"></lr-carousel-item>
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
above). An explicit `role`, `aria-roledescription` or `aria-label` you set yourself always wins.

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
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected)
- `label: string = ''` — accessible group name; a host `aria-label` is used when `label` is empty

**Slots:** default action controls.

**CSS parts:** `base` (the `role="group"` flex wrapper; wraps, and goes full-width below a 20rem
container inline-size).

**Themeable custom properties:** `--lr-button-group-gap` (default `var(--lr-space-2xs)`) — gap
between slotted controls on both axes.

**Sizing gotcha — give it an explicit width.** `:host` is `display: inline-flex` *and* declares
`container-type: inline-size` unconditionally (that is what makes the 20rem `@container` rule above
fire at all). Inline-size containment means the box's own content can no longer contribute to its
width, so in any context where the host would otherwise be shrink-to-fit — plain block flow, an
`inline-flex`/`flex` parent, anywhere with no definite width — the group collapses to its
`min-inline-size` floor of `var(--lr-icon-button-size)` (2.5rem) instead of growing to fit the
slotted buttons. Give `<lr-button-group>` a definite width (`inline-size`, `width: 100%`, `flex: 1`,
or a grid track) whenever it isn't already in a layout that supplies one. The floor itself is the
safeguard: without it the same shape rendered at literally `0px`.

---

## `lr-scroller`

Responsive overflow surface with optional previous/next controls. The default slot remains the
consumer's content, and the viewport is a native scroll container that works in narrow panels as
well as full-width layouts.

**Properties:**
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected)
- `controls: boolean = false` (reflected) — show previous/next controls
- `hideScrollbar: boolean = false` (attribute `hide-scrollbar`, reflected) and
  `withoutScrollbar: boolean = false` (attribute `without-scrollbar`, reflected) — retained Lyra
  and upstream spellings of the same native-scrollbar opt-out; either one hides it
- `withoutShadow: boolean = false` (attribute `without-shadow`, reflected) — suppresses both
  logical edge cues without changing native scrolling or the optional controls
- `scrollStep: number = 0` (attribute `scroll-step`) — custom step; zero uses 80% of the viewport
- `label: string = ''` — accessible region name; a host `aria-label` is used when set

**Events:** `lr-scroll` with `scrollStart`, `scrollEnd`, `scrollLeft`, and `scrollTop` in the
detail object.

**Slots:** default scrollable content.

**CSS parts:** `base`, `viewport`, `content`, `start-shadow`, `end-shadow`, `previous`, `next`,
`control` (shared by `previous` and `next`), and `previous-glyph`/`next-glyph` (the chevron inside
each, mirrored under RTL). Each shadow is hidden at its corresponding measured edge and uses
logical positioning, so both cues and gradients mirror under RTL and rotate to the block axis in a
vertical scroller.

**Themeable custom properties:** `--lr-scroller-control-size` (default `var(--lr-size-2rem)`) — the
previous/next control's box size; the interactive target never shrinks below `--lr-icon-button-size`
regardless. `--lr-scroller-min-block-size` (default `var(--lr-size-10rem)`) — the vertical
orientation's minimum block size, ignored while horizontal. `--shadow-color` (default
`var(--lr-color-surface)`) and `--shadow-size` (default `var(--lr-size-2rem)`) theme each edge cue's
base color and logical extent.

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

**Two child models are accepted**, and a group is read as one or the other — never a mix.

*Element model* (`<lr-tab panel="x">` + `<lr-tab-panel name="x">`) mirrors both upstreams, so that
markup renames mechanically. The group assigns the `slot` attributes itself; you never write them.
Each `<lr-tab>`'s content is projected into the real `role="tab"` button, so a tab can carry an icon
or a badge while the button's accessible name stays exactly that content's text. A group containing
any `<lr-tab>` child is read purely as this model. `active` on a tab/panel pair is an SSR hint: the
group reads an initially active tab and then keeps both child attributes synchronized with its own
`active` selection after hydration.

*Attribute model* — this library's own original shape, fully supported: panels are direct light-DOM
children carrying `slot="<id>"` (the panel's stable id) and `label="<text>"` (the tab button's text).
One named `<slot>` is rendered per distinct `slot` name found among the current children; a child
with no `label`, or a name with no matching child, simply never produces a tab.

Implements the WAI-ARIA APG tabs pattern. With the default `activation="auto"`, Left/Right (swapped
under RTL, or Up/Down when `placement` is `start`/`end`) move focus *and* selection together; with
`activation="manual"` they move focus only and Enter/Space commits. Home/End jump to the first/last
enabled tab, and a roving `tabindex` follows the focused tab.
An enabled `closable` `<lr-tab>` also puts `aria-keyshortcuts="Delete"` on its real tab button.
Delete emits that descriptor's `lr-close` request without creating a second tab stop or changing
selection.

A tab button's *visible* content can carry a leading icon without ever changing its *accessible
name* (always exactly `label`'s text): give a tab an extra direct-child sibling of `<lr-tab-group>`
carrying `slot="<id>-icon"` (that sibling's own content — inline SVG, emoji span, a custom icon
element, anything — is entirely up to the consumer). It renders ahead of the label inside that tab's
button, wrapped in an `aria-hidden="true"` `[part="tab-icon"]` so it's excluded from accessible-name
computation regardless of content. A tab with no matching `<id>-icon` sibling renders no icon
wrapper at all, so existing text-only tabs are unaffected.

**Properties:**
- `active: string = ''` (reflected) — the active tab's `slot`/id; falls back to the first enabled
  tab whenever the current value doesn't resolve to one (including on every children/attribute
  change, tracked via a `MutationObserver`)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name applied to the
  `role="tablist"` strip; attribute-reflects from a host-level `aria-label`. Unset, the tablist
  renders without an `aria-label` (there is no localized default name).
- `placement: 'top' | 'bottom' | 'start' | 'end' = 'top'` (attribute `placement`, reflected) — which
  edge the strip sits on. `start`/`end` are *logical*, so they mirror under RTL with no `:dir()`
  rule of your own; either turns the tablist vertical, which sets `aria-orientation="vertical"` and
  switches the navigation keys to Up/Down per the APG.
- `activation: 'auto' | 'manual' = 'auto'` (reflected) — `auto` moves selection with focus; `manual`
  moves focus only and waits for Enter or Space. Use `manual` whenever revealing a panel is
  expensive: automatic activation would reveal every panel the user arrows past. Under `manual` the
  roving `tabindex="0"` sits on the *focused* tab, which may differ from the selected one.
- `withoutScrollControls: boolean = false` (reflected, attribute `without-scroll-controls`) and
  `noScrollControls: boolean = false` (reflected, attribute `no-scroll-controls`) — the same opt-out
  under Web Awesome's spelling and Shoelace's. Both are read, either one suppresses the overflow
  scroll controls described below, and neither is deprecated: a consumer arriving from either
  upstream finds their own attribute working. Left unset, an overflowing horizontal strip gets the
  controls.
- `fixedScrollControls: boolean = false` (reflected, attribute `fixed-scroll-controls`) — Shoelace
  compatibility flag. Lyra's overflow controls already remain at both logical edges whenever the
  row overflows, so the flag explicitly preserves that fixed behavior without changing it.
- `defaultSlot: HTMLSlotElement` (property only) — the real unnamed shadow slot expected by mapped
  integrations. Lyra exposes it for slot observation but keeps it hidden because every accepted
  tab and panel is projected through a deterministic named slot.

**Methods:** `show(name: string): void` activates the matching enabled tab through the same
`lr-tab-hide` then `lr-tab-show` sequence as pointer/keyboard selection. Unknown, disabled, and
already-active names are no-ops.

**Overflow and scrolling.** The tablist is a native scroll container (`overflow-x: auto`) — there is
no scroll listener and no scroll-position state anywhere in this component. A horizontal row that
does not fit additionally gets **two scroll-control buttons flanking it inside `[part="nav"]`**,
mirroring both upstreams, plus a fade at each edge. Both affordances are gated on the same
measurement of the tablist's real overflow, so a row that fits is never flanked by two dead buttons
and never dimmed. The controls are rendered only for a horizontal `placement`: a `start`/`end` strip
scrolls in the block direction, which these controls do not address (the same restriction both
upstreams apply), and the edge fade is switched off there too because it measures the inline axis.
One press travels 80% of the visible row — short of a full viewport on purpose, so something that
was on screen before the press is still on screen after it — smoothly, or instantly under
`prefers-reduced-motion`. Under RTL the whole row mirrors and the step direction inverts with it.

The controls are `aria-hidden="true"` and `tabindex="-1"`: a pointer affordance only, matching
upstream. The strip is already fully keyboard-scrollable without them — the roving `tabindex` puts
every tab one arrow key away and focusing a tab scrolls it into view — so two extra tab stops in the
middle of the strip would buy no capability. They still carry a localized `aria-label`, so the name
is there for automation and for a consumer that chooses to expose them. Pressing one does not move
focus off the tab the user was on.

**Events:**
- `lr-tab-show` (`detail: { name: string, tabId: string }`) — a tab became active via click,
  keyboard, or `show()`. `name` is the upstream spelling and `tabId` is Lyra's retained alias; both
  contain the same panel name. Not fired
  when `active` self-corrects to a valid tab (initial default, or a tab disappearing/becoming
  disabled underneath the current selection).
- `lr-tab-hide` (`detail: { name: string, tabId: string }`) — the outgoing tab, emitted immediately *before* the
  matching `lr-tab-show`, so a listener that tears down the old panel always runs before the one
  that builds the new one. Not fired when there was no previous selection.

**Slots:** default — either `<lr-tab>`/`<lr-tab-panel>` pairs, or direct children with
`slot="<id>" label="<text>"` (and optionally `disabled`), one becoming each tab's panel. `<id>-icon`
— optional sibling direct child supplying a tab's leading icon content, in the attribute model only;
excluded from the tab button's accessible name. `nav` is the upstream-compatible projection slot
used by `<lr-tab>` descriptors before the hydrated group assigns its per-tab internal slot.

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
mirrors under RTL, never the icon), `tab` (a single tab button), `tab-icon` (the optional
leading-icon wrapper inside a tab button; only rendered when that tab has a matching `<id>-icon`
sibling), `active-tab-indicator` (the selected tab's directional indicator), and `panel` (a single
`role="tabpanel"` wrapper, one per tab, hidden unless active).
The two controls exist in the DOM whenever the group can have them at all (horizontal `placement`,
no opt-out) and are taken out of layout while the tablist is not overflowing — the qualifier that
hides them is wrapped in `:where()`, so a consumer's own `::part(scroll-button)` rule outranks it
without `!important`.

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the mask fade
at each inline scroll edge of the tablist, painted only while the tablist actually overflows and
only for a horizontal `placement`. `--lr-tab-group-selected-color` (default
`var(--lr-color-brand)`) — text color of the selected tab, scoped to `[aria-selected='true']` only,
so it never repaints a hovered unselected tab. `--lr-tab-group-indicator-color` (default
`var(--lr-color-brand)`) — the selected tab's indicator rule, themeable independently of its text
color (an underline on a `top`/`bottom` strip, an inline edge on a vertical one).
`--lr-tab-group-hover-color` (default `var(--lr-color-text)`) — text color of a hovered, non-disabled
tab, independent of the two selected-state hooks. All three are declared as inline `var()` fallbacks
at the point of use rather than on `:host`, so each can be set on the element *or on any ancestor* —
the pattern exists because `::part(tab)[aria-selected='true']` is invalid CSS (Shadow Parts forbids
an attribute selector after `::part()`), which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-text` tokens as the only way to restyle a selected or hovered tab,
repainting everything else that reads them. Unset, each falls back to the token its rule used
before, so rendering is unchanged. The upstream hooks `--indicator-color` (selected indicator),
`--track-color` (resting strip rule), and `--track-width` (resting strip-rule thickness) are read
first, with the Lyra/token values as fallbacks. Otherwise shared tokens —
`--lr-space-xs/-s/-m`, `--lr-color-border/-text-quiet/-text/-brand`, `--lr-transition-fast`,
`--lr-radius`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-tab-group active="general">
  <div slot="general" label="General">General settings…</div>
  <div slot="advanced" label="Advanced" disabled>Advanced settings…</div>
</lr-tab-group>
<script type="module">
  const group = document.querySelector('lr-tab-group');
  group.addEventListener('lr-tab-show', (e) => console.log(e.detail.name, e.detail.tabId));
  group.show('general');
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
- Tabs are rebuilt from direct children via a `MutationObserver` watching `childList` plus
  `attributeFilter: ['slot', 'label', 'disabled', 'inert', 'closable']` — not `slotchange` — because a brand-new tab's
  `slot` name has no matching `<slot>` to fire `slotchange` on until this component has already
  rendered one for it, and neither `slotchange` nor any Lit lifecycle hook observes a plain
  attribute edit on a light-DOM child at all.
- If two children share the same `slot` name, the *first* one wins for the tab button's label
  (matches native slot assignment: both would render into the one panel, but only one label can back
  the button).
- The navigation keys follow `placement`, not the writing mode: a `top`/`bottom` strip uses
  Left/Right (swapped under RTL via `internal/rtl.ts`'s `isRtl()`), and a `start`/`end` strip uses
  Up/Down with no RTL swap, because block flow does not reverse. Only one pair is live at a time —
  there is no set of keys that works for both placements.
- The two overflow controls are `aria-hidden`, so an automated check that looks for a *focusable*
  "scroll tabs" button will not find one. Assert on `[part~="scroll-button"]` (and on the tablist's
  `scrollLeft` moving) instead.

---

## `lr-stepper`

Ordered multi-step wizard/form navigation: an index/label per step, `current`/`completed`/`disabled`/
`error` state, and click-to-jump. First-party invention (no `wa-*`/`sl-*` counterpart). Fully
data-driven and controlled, like `lr-table`'s `columns`/`rows` — it never mutates `steps` itself; a
click, or Enter/Space on a non-disabled step, fires a non-cancelable `lr-step-select`, and the host
decides whether/how `steps` changes in response.

**Properties:**
- `steps: StepItem[] = []` (attribute: false) — `StepItem { id: string; label: string; state:
  'pending' | 'current' | 'completed' | 'disabled' | 'error'; title?: string; icon?: unknown }`;
  `title` is an optional native tooltip for the step's button (e.g. explaining why a `disabled` step
  is locked) — omit it for no `title` attribute at all, not an empty string. `icon` is an optional
  leading topic glyph (a `TemplateResult`, an emoji string, etc. — not restricted to a square icon)
  rendered in the `step-icon` part additionally to, never instead of, the state-driven
  `step-index`/`step-check` glyph. Never mutated by this component. Empty (the default) renders
  nothing.
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
  `<lr-split>`'s identically-named contract, unit handling included.
- `orientationBreakpointBasis: 'container'|'viewport' = 'container'` (reflected, attribute
  `orientation-breakpoint-basis`) — which box `orientationBreakpoint` is compared against. Unset,
  behavior is identical to before this property existed. `'container'` measures the stepper's own
  `[part='base']` via `ResizeObserver`, comparing strictly `<`; `'viewport'` evaluates
  `matchMedia('(max-width: <breakpoint>)')`, arms no `ResizeObserver`, and compares inclusively
  (`<=`) per native `max-width` semantics. **A stepper given a fixed width in a row layout cannot
  react to that row stacking by measuring itself — its own width never changes — so that case
  requires `'viewport'`.** Relative units also differ by basis: inside a media query they resolve
  against the browser's *initial* font size, ignoring `html { font-size }`, which is precisely why
  `'viewport'` matches a CSS `@media` rule authored with the same length. Mirrors `<lr-split>`'s
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
  renders without an `aria-label` (there is no localized default name).

**Events:** `lr-step-select` (`detail: { index, id }`) — fired on click, or Enter/Space while
focused, on a non-`disabled` step. It is non-cancelable because the component takes no default
action to veto: it never mutates `steps`. `lr-stepper-orientation-change`
(`detail: { orientation }`) — fired only when an enabled `orientationBreakpoint` actually changes
`effectiveOrientation`.

**Slots:** none.

**CSS parts:** `base` (root wrapper, `role="list"`), `step-item` (the `role="listitem"` wrapper for
one step), `step` (a single native button; the current step carries `aria-current="step"` and every
other step carries `aria-current="false"`),
`step-icon` (optional leading topic glyph from the step's `icon` field; only rendered when the step
has one, additionally to — never instead of — `step-index`/`step-check`), `step-index` (the numbered
index chip, shown for `pending`/`current`/`error` steps), `step-check` (the completed-checkmark
glyph, shown for `completed` steps instead of `step-index`), `step-label` (the step's label text).

**Themeable custom properties:** `--lr-stepper-current-color` (default `var(--lr-color-text)`) —
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
each falls back to the token its rule used before. Otherwise shared tokens —
`--lr-space-m`/`-xs`/`-2xs`,
`--lr-color-text-quiet`/`-text`/`-danger`/`-brand`/`-on-brand`, `--lr-radius`/`-pill`,
`--lr-font-size-xs`, `--lr-font-weight-semibold`, `--lr-opacity-disabled`,
`--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-stepper></lr-stepper>
<script type="module">
  const stepper = document.querySelector('lr-stepper');
  stepper.steps = [
    { id: 'account', label: 'Account', state: 'completed' },
    { id: 'billing', label: 'Billing', state: 'current' },
    { id: 'review', label: 'Review', state: 'pending' },
  ];
  stepper.addEventListener('lr-step-select', (e) => console.log(e.detail.index, e.detail.id));
</script>
```

**Known gotchas:**
- `orientationBreakpointBasis='container'` (the default) observes **the stepper's own allocated
  inline size**, so it fits a stepper that is the sole flex/grid item in its measured container. In
  a row where the stepper is a fixed-width sidebar beside another element, its own width never
  changes with the viewport at all, so no container breakpoint can react to that row stacking via a
  CSS `@media` rule. Use `orientationBreakpointBasis='viewport'` for that layout — give the stepper
  and its sibling the same `orientation-breakpoint` and both flip in lockstep with the CSS rule. See
  `<lr-split>`'s own note above for the full explanation of why a shared row can't be inferred from
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
button.

**Properties:** `panel: string = ''` (reflected) — the `name` of the `<lr-tab-panel>` this tab
reveals; `disabled: boolean = false` (reflected) — removes the tab from keyboard navigation and
prevents activation; `active: boolean = false` (reflected) — SSR selection hint, synchronized by
the owning group after hydration; `closable: boolean = false` (reflected) — shows the mapped close
affordance.

**Events:** `lr-close` (no detail) — the Lyra-convention mapping of Shoelace's `sl-close`, emitted
when the close affordance is clicked or Delete is pressed on the focused owning tab. It bubbles, is
composed and noncancelable. A disabled tab never emits it. The tab never removes itself or its
panel; the consumer handles the request. The owning group separately emits
`lr-tab-show`/`lr-tab-hide`. **Slots:** default (the tab's visible content). **CSS parts:** `base`
and `tab` are aliases on the same projected-content slot; `close-button` and
`close-button__base` are aliases on the same non-focusable visual close affordance. Style the
group's `tab` part for the real interactive tab button.

**Themeable custom properties:** none of its own, and the group's are not settable here. The button
this tab is projected into lives in `<lr-tab-group>`'s shadow root, so it inherits
`--lr-tab-group-selected-color`, `--lr-tab-group-indicator-color` and `--lr-tab-group-hover-color`
from the group host or an ancestor of it. Declaring one on the `<lr-tab>` itself does nothing: this
element is *inside* that button in the flattened tree, and inheritance only runs the other way.

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
const group = document.querySelector('#documents');
group.addEventListener('lr-close', (event) => {
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
- `label: string = ''` — accessible name for the internal `role="group"`; when empty, a host
  `aria-label` is forwarded as a fallback.
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

**Events:** `lr-reorder` (`detail: { order: string[], fromIndex: number, toIndex: number }`,
cancelable — fired before a move is applied; `order` is every item's `value` (or its
DOM-position-index fallback) in the order the move WOULD produce. Uncanceled, the move applies
synchronously right after. `preventDefault()` holds the move instead: the affected item reflects
`pending`, and no other move can start until the host resolves it — see **Methods** below.

**Methods:** `finalizePendingMove()` — applies a move held via `preventDefault()`.
`revertPendingMove()` — discards a held move, restoring the prior order. Both no-op when nothing
is pending.

**Slots:** default — `<lr-reorder-item>` elements.

**CSS parts:** `base` — the internal `role="list"` wrapper.

**Themeable custom properties:** `--lr-reorder-list-gap` (default `var(--lr-space-2xs)`) — gap
between rows.

```html
<lr-reorder-list label="Form fields" @lr-reorder=${(e) => console.log(e.detail.order)}>
  <lr-reorder-item value="name">Name</lr-reorder-item>
  <lr-reorder-item value="email">Email</lr-reorder-item>
  <lr-reorder-item value="phone">Phone</lr-reorder-item>
</lr-reorder-list>
```

**Known gotchas:**
- Boundary-disabled state (`atStart`/`atEnd`) and the `listDisabled` cascade are computed and
  pushed onto each `<lr-reorder-item>` by this list, on every slot change and every move — an item
  alone can't know its own position.
- No pointer drag-and-drop; move-up/move-down buttons and the keyboard shortcut only.

---

### `lr-reorder-item`

**Properties:**
- `value?: string` — stable identifier included in the parent's `lr-reorder` order array; falls
  back to this item's live DOM-position index when unset.
- `disabled: boolean = false` (reflected) — disables this row's own move buttons only; does not
  hide its slotted content.
- `atStart: boolean = false`, `atEnd: boolean = false`, `listDisabled: boolean = false`
  (attribute: false) — pushed down by the parent `<lr-reorder-list>`; normally set internally, not
  by consumers.
- `pending: boolean = false` (reflected) — set while this item's move is held via the parent's
  `lr-reorder` `preventDefault()`. Informational only (doesn't itself disable the item's buttons);
  style via `lr-reorder-item[pending]`. Pushed down by the parent; normally set internally.

**Events:** `lr-move-request` (`detail: { direction: 'up' | 'down' }` — a move button was activated
while not disabled; handled by the parent `<lr-reorder-list>`, which performs the actual move)

**Slots:** default — arbitrary row content.

**CSS parts:** `base` (row wrapper), `move-up-button`, `move-down-button`, `content` (default-slot
wrapper).

**Themeable custom properties:** `--lr-reorder-item-gap` (default `var(--lr-space-xs)`) — gap
between the move buttons and the row content.

---

## `lr-segmented`

A single-select button row with the WAI-ARIA APG `radiogroup` contract built in:
`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move
both select immediately, like a native radio group), cyclic Arrow/Home/End navigation among
non-disabled items. First-party invention (no `wa-*`/`sl-*` counterpart) — "choose exactly one of N
labeled options, rendered as a button row" is ubiquitous settings/filter-panel UI.

**Properties:**
- `items: SegmentedItem[] = []` (attribute: false) — `SegmentedItem { value: string; label: string;
  icon?: unknown; disabled?: boolean }`; `icon` renders as a decorative leading visual inside
  `segment-icon` and does not replace the required text label.
- `value: string = ''` — the currently selected item's `value`.
- `label: string = ''` — accessible name copied to the internal `role="radiogroup"`; when empty, a
  host-level `aria-label` is used as a fallback.
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
`segment-icon` (an optional decorative leading icon), `segment-label` (the segment's label text).

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the mask fade
at each horizontal scroll edge of the track, painted only while the track actually overflows (a row
that fits is never dimmed). `--lr-segmented-track-min-height` (default
`var(--lr-form-control-height)`), `--lr-segmented-segment-padding` (default
`var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)`), and
`--lr-segmented-font-size` (default `var(--lr-form-control-font-size)`) are the three knobs the
`size` tier moves — each points at the shared ladder rather than carrying a per-tier value of its
own, so retuning one tier for this component alone is a one-line override instead of a fork. All
three are declared on `:host`, so set them on the element itself for a density the ladder doesn't
cover; an ancestor rule is shadowed.

`--lr-segmented-track-height` pins the `base` track's exact height at every `size` tier (it sets
both `block-size` and `min-block-size`), for a row that has to sit flush beside a hard-sized toolbar
control. It is **genuinely undeclared by default** — not `auto` — and that is load-bearing: an
exact-height hatch only works as an undeclared sentinel, because `auto` is itself a valid value that
would always win and would silently turn every tier's `--lr-segmented-track-min-height` floor into
dead code. While it is unset, each tier keeps its own floor and the track grows with its content.
The floor at the two compact tiers is the ladder's own (20px at `2xs`, 24px at `xs`), but every
`2xs`/`xs` *segment* separately carries a 24×24px minimum box, so the tappable target holds even
when a label is a single character and the track ends up taller than its nominal floor.

`--lr-segmented-selected-bg` (default `var(--lr-color-surface)`), `--lr-segmented-selected-color`
(default `var(--lr-color-text)`), `--lr-segmented-selected-font-weight` (default
`var(--lr-font-weight-semibold)`) and `--lr-segmented-selected-shadow` (default
`var(--lr-shadow-xs)` — the shallowest step in the elevation scale, since the checked segment is a
thumb lifted a hair off its own track) style the checked segment's pill;
`--lr-segmented-hover-color` (default `var(--lr-color-text)`) styles a hovered segment that is
neither checked nor disabled, independently of the four above — so recoloring the checked pill never
bleeds onto hover. All five are inline `var()` fallbacks at the
point of use rather than `:host` declarations, so each can be set on the element *or on any
ancestor*; unset, each falls back to the token its rule used before. They exist because
`::part(segment)[aria-checked='true']` is invalid CSS — Shadow Parts forbids an attribute selector
after `::part()` — which previously left hijacking the library-wide
`--lr-color-surface`/`--lr-color-text` tokens as the only way to restyle a selected segment,
repainting every other element that read them.

Otherwise shared tokens — `--lr-color-border`/`-surface`/`-text`/
`-text-quiet`, `--lr-radius`, `--lr-font-weight-semibold`, `--lr-shadow-xs`,
`--lr-opacity-disabled`, `--lr-focus-ring-*`, and the `--lr-form-control-*` knobs the `size` tier
resolves.

**Optional peer deps:** none.

```html
<lr-segmented></lr-segmented>
<script type="module">
  const seg = document.querySelector('lr-segmented');
  seg.items = [
    { value: 'day', label: 'Day', icon: '☀' },
    { value: 'week', label: 'Week', icon: '▦' },
    { value: 'month', label: 'Month' },
  ];
  seg.value = 'week';
  seg.addEventListener('lr-change', (e) => console.log(e.detail.value));
</script>
```

**Known gotchas:**
- arrow-key navigation cycles (past the last non-disabled item wraps to the first, and vice versa)
  rather than clamping at the first/last item, unlike `lr-stepper`'s clamped Left/Right.
- this component self-selects on navigation: clicking or arrow-navigating to an item immediately
  updates `value` and fires `lr-change` — there's no separate "commit" step the way, e.g.,
  `lr-select`'s popup has.
- the semantic `radiogroup` lives inside shadow DOM. Set `label` (preferred for reactive code) or a
  host `aria-label`; the component deliberately forwards the resulting name to that internal role.

**Additional API surface:**

- `--lr-segmented-track-gap` — Gap between segments. Default: `var(--lr-size-0-125rem)`.
- `--lr-segmented-track-radius` — Track corner radius. Default: `var(--lr-radius)`.
- `--lr-segmented-track-padding` — Track inset padding. Default: `var(--lr-size-0-125rem)`.

---

## `lr-virtual-list`

A generic windowed/virtualized list host. Renders only the items within the current viewport (plus
`overscan` padding rows on each side) as real DOM, regardless of how large `items` is, so a
multi-thousand-row chat-history sidebar (or a long message thread) stays cheap to scroll. Content is
entirely caller-supplied: `renderItem(item, index)` returns whatever `lit-html` value should represent
that row, and `keyFunction(item, index)` gives it a stable identity for DOM reconciliation. First-party
invention (no `wa-*`/`sl-*` counterpart).

**Properties:**
- `items: unknown[] = []` (attribute: false) — the full, non-windowed item collection. JS-only; set via
  a property/lit-html binding (`.items=`), not an HTML attribute.
- `renderItem: (item: unknown, index: number) => unknown = () => nothing` (attribute: false) — renders
  one row's content, typically returning a `lit-html` `TemplateResult`. JS-only.
- `keyFunction?: (item: unknown, index: number) => string | number` (attribute: false) — derives a
  row's stable reconciliation key. JS-only. Falls back to the item's index in `items` when omitted,
  which is only a safe identity while `items` never reorders/inserts/removes — provide this whenever
  possible, or scroll position and per-row DOM state (e.g. an `<audio>` element's playback position)
  can attach to the wrong row across a mutation.
- `groups?: VirtualListGroup[]` (attribute: false) — renders a labeled marker at each group's
  `startIndex`, positioned independently of the row window (so it stays in place as its rows scroll
  past). Groups are sorted by `startIndex`; a `startIndex` that's non-integer, out of range, or a
  duplicate of an earlier group's is silently dropped rather than rendered wrong. An entry whose
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
  *visual copy* of content that already exists in the list, which fixes its contract:
  - it is `aria-hidden`, and ordinary focusable HTML inside it is forced to `tabindex="-1"`, so the
    real row keeps sole ownership of the heading semantics and of the tab order (a focus-delegating
    custom element rendered into the copy needs its own `tabindex="-1"`; `inert` is deliberately not
    used, because it would also block the pointer opt-in below);
  - it is `pointer-events: none` by default — opt back in with
    `lr-virtual-list::part(sticky-group) { pointer-events: auto; }` when the copied header content is
    interactive;
  - it is never measured as a row, so a group header that is also a real row is not double-counted in
    `row-height="auto"` mode;
  - its measured height is applied as `scroll-padding-block-start` on the scroll container and
    subtracted from top-aligned scroll targets, so `active-id`, `scrollToIndex({ align: 'start' })`
    and native keyboard scrolling all stop *below* the band instead of parking the row behind it.

  The callback runs on every scroll-driven update, so keep it cheap and side-effect free. While the
  viewport is above the first group there is nothing to pin: the band shows nothing, but it stays
  mounted (called with the first group, rendered hidden) so its height is known before the first
  programmatic jump rather than only after it.
- `rowHeight: string = 'auto'` (attribute `row-height`) — `'auto'` measures each row's real height via
  `ResizeObserver`; a numeric string (e.g. `"56"`) fixes every row to that many pixels. Anything else
  (non-numeric, zero, negative, non-finite) silently falls back to `'auto'` rather than throwing.
- `itemRole: 'listitem' | 'row' = 'listitem'` (attribute `item-role`) — `'listitem'` (default)
  preserves the plain `role="list"`/`role="listitem"` mapping with `aria-setsize`/`aria-posinset`.
  `'row'` additionally maps `[part="base"]` to `role="rowgroup"`, `[part="spacer"]` to
  `role="presentation"`, and each row to `role="row"` with `aria-rowindex` instead — for a consumer
  composing its own `role="table"` wrapper and header row around this component (see
  `lr-dataset-viewer`).
- `rowIndexOffset: number = 0` (attribute `row-index-offset`) — added to a row's 1-based index to
  compute `aria-rowindex` in `item-role="row"` mode (e.g. `1` when a consumer renders its own header
  row occupying `aria-rowindex="1"` outside this component). No effect in `'listitem'` mode.
- `overscan: number = 6` — extra rows rendered beyond the visible viewport on each side; finite
  values are floored and clamped to 0–100, while non-finite values use the default 6, so an invalid
  runtime value cannot disable windowing and render the entire collection.
- `activeId: string | number | '' = ''` (attribute `active-id`) — when set and it matches a row's `keyFunction`
  result (compared with `Object.is` against the typed value — attribute values arrive as strings, so
  assign the property directly for a numeric key), that row is smoothly scrolled into view whenever
  this changes, and rendered with `aria-current="true"`.
- `loading: boolean = false` (reflected) — sets `aria-busy` on the scroll container and a `cursor:
  progress` style; does not by itself gate `lr-load-more` (see below).
- `hasMore: boolean = false` (attribute `has-more`, reflected) — when true, scrolling near the bottom
  fires `lr-load-more` (gated by `loading`).

**Exported types:** `VirtualListRange { start: number; end: number }` (the `lr-visible-range-changed`
detail shape); `VirtualListGroup { key: string | number; label?: string; startIndex: number }` — the
shape consumed by `groups` above; `VirtualListScroll { scrollTop: number; viewportHeight: number }` —
the `lr-scroll` detail shape.
The package root also exports `groupByRecency(items, options?)`, a DOM-free helper that returns
non-empty Today/Yesterday/Previous 7 Days/Older buckets, preserves input order within each bucket,
and accepts a timestamp extractor, reference date, and label overrides.

**Methods:** `scrollToIndex(index, options?)` — the programmatic counterpart to `active-id`'s
automatic scroll-into-view, for a host that needs to scroll to a specific row without changing which
row is "active." `options.align` is `'start'`, `'end'`, or `'auto'` (default — no scroll at all when
already fully visible); `options.behavior` (default `'smooth'`) is forced to `'auto'` under
`prefers-reduced-motion: reduce`. `index` is clamped to `0…items.length-1`.
`offsetForIndex(index)` returns the pixel top row `index` renders at, in the same coordinate space as
the scroll container's `scrollTop`; it is clamped to `0…items.length`, so `offsetForIndex(items.length)`
is the total content height and an empty list is always `0`. `indexAtOffset(px)` is its inverse — the
row whose box contains that offset, clamped at both ends, `-1` for an empty list — so
`indexAtOffset(offsetForIndex(i)) === i` and `indexAtOffset(scrollContainer.scrollTop)` is the row at
the top of the viewport. In `row-height="auto"` mode both are estimate-based for any row that (or
above which) has not been measured yet, and converge as those `ResizeObserver` measurements land;
fixed numeric `row-height` offsets are exact from the first render. Both read the most recent render,
so `await el.updateComplete` after assigning `items` before querying.

**Getters:** `scrollContainer: HTMLElement | undefined` — the real scroll container (`[part="base"]`),
`undefined` before the first render; for a host that needs the live scroll position or wants to scroll
the list itself without reaching into the shadow root. `renderedRows: HTMLElement[]` — the row
wrappers (`[part="row"]`) that currently exist as real DOM, in item order (the current window, not the
whole collection; empty before the first render). It exists for hosts that must *reach* a rendered row
rather than style it — keyboard focus management across a windowed list, where the row to focus may
not have existed a frame earlier, and which `exportparts` cannot serve since it forwards styling, not
element references. Treat both as read-only: positioning, keys, and lifetime belong to the windowing
math, and any row element can be recycled or removed on the next update.

**Events:** `lr-load-more` (no detail — fired once per approach to the bottom of the list while
`has-more` is true and `loading` is false; does not refire on every scroll tick while still near the
bottom — scrolling back away from the bottom and returning, or `items` growing enough to move the
window away from the end, re-arms it), `lr-visible-range-changed` (`detail: VirtualListRange`, the
current visible, non-overscanned item index range — fired only when it actually changes), `lr-scroll`
(`detail: VirtualListScroll` — the scroll container moved; emitted from the same animation frame that
already coalesces native `scroll` events, so a fling produces at most one per frame and none at all
when the position did not change. Unlike `lr-visible-range-changed`, which only fires on index-range
changes, this reports *sub-row* movement, which is what scroll-linked layout needs)

**Slots:** none — all content comes from `renderItem`.

**CSS parts:** `base` (the scrollable container, `role="list"` — or `role="rowgroup"` in
`item-role="row"` mode — `tabindex="0"`), `spacer` (the full-content-height inner element
establishing true scroll extent; `role="presentation"` in `item-role="row"` mode), `row` (one
rendered row's absolutely-positioned wrapper, `role="listitem"` — or `role="row"` with
`aria-rowindex` in `item-role="row"` mode), `group` (a `groups` entry's positioned marker; not
rendered for an entry whose `label` is the empty string), `sticky-group` (the pinned copy of the
current group, present only while `renderStickyGroup` is set — `aria-hidden` and
`pointer-events: none` by default; style it with `pointer-events: auto` to make copied interactive
content clickable, and it shows nothing while the viewport is above the first group)

**Themeable custom properties:** `--lr-virtual-list-height` (default `24rem` — the host's bounded
scroll extent; component-specific since a virtualized list is meaningless without a sized viewport),
plus shared `--lr-focus-ring-width/-color/-offset` (inward-offset ring on `[part="base"]`, negative
so it isn't clipped by the container's own `overflow: auto`). `[part="base"]` also carries a
mouse-hover outline — a subtler preview of that same `:focus-visible` ring, shown because the part
always carries `tabindex="0"` and is a real keyboard-navigable target — tinted via
`--lr-virtual-list-hover-outline-color` (default `var(--lr-color-border-strong)`); set it to
`transparent` to opt out of the hover treatment entirely.

**Optional peer deps:** none.

```html
<lr-virtual-list
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
  active-id=${currentId}
  ?has-more=${hasMorePages}
  ?loading=${isLoadingMore}
  @lr-load-more=${() => loadNextPage()}
  @lr-visible-range-changed=${(e) => console.log('visible', e.detail.start, e.detail.end)}
></lr-virtual-list>
```

```html
<!-- Sticky group headers: the header is a real row, so the `groups` entries are position anchors
     only (`label: ''`), and the pinned copy opts back into pointer events for its own toggle. -->
<lr-virtual-list
  .items=${rows}
  .groups=${groupStarts /* [{ key: 'Today', label: '', startIndex: 0 }, …] */}
  .renderItem=${(item, index) => (item.isHeader ? headerTemplate(item) : rowTemplate(item))}
  .renderStickyGroup=${(group) => headerTemplate(group)}
></lr-virtual-list>
<style>
  lr-virtual-list::part(sticky-group) { pointer-events: auto; }
</style>
```

Every row — in both `row-height` modes — is positioned by a `transform: translateY(offset)` computed
from a single cumulative offsets array, rather than by page flow; this is what lets a small DOM window
exist while the scrollbar still reflects the true total content height. That array is rebuilt only
when `items`, `row-height`, or `keyFunction` change, or a row's measured height changes — **not** on
every update, so a pure scroll-position tick (potentially every `rAF` while scrolling) only re-runs the
cheap range/visibility math, never the `O(n)` offsets rebuild (which, in `row-height="auto"` mode, also
means a `keyFunction` call per item). In `row-height="auto"` mode, unmeasured rows contribute a fixed
estimate to that array until their real `ResizeObserver`-reported height lands, so only rows after a
newly-measured one shift on each measurement rather than the whole list reflowing. The offsets rebuild,
when it does run, is an `O(n)` loop appropriate for hundreds to a few thousand rows (a scrollable
history sidebar); it is not the right approach for a hundred-thousand-row list without further work
(e.g. a Fenwick/segment tree for `O(log n)` offset queries+updates).

**Known gotchas:**
- `items`, `renderItem`, `keyFunction`, and `groups` are all `attribute: false` — they must be set as
  JS properties (`.items=`, `.renderItem=`, …), never as HTML attribute strings.
- The container is `role="list"` with rows `role="listitem"`, deliberately not `listbox`/`option` —
  this component only provides windowing, not the roving-tabindex/`aria-activedescendant`
  keyboard-interaction contract a real `listbox` requires. `active-id` only scrolls a row into view and
  marks it `aria-current`; it is not a selection widget. Compose your own selection behavior on top if
  needed.
- `[part="base"]` carries `tabindex="0"` unconditionally, since `renderItem`'s caller-supplied content
  isn't guaranteed to contain a focusable element and an otherwise-unreachable-by-keyboard scroll
  region would result.
- `aria-setsize`/`aria-posinset` are computed from a row's real index in the full `items` array, not its
  position among the currently-rendered DOM window, so assistive tech still announces e.g. "item 12 of
  340" correctly even though only a handful of rows exist in the DOM at a time.
- `groups`, `renderStickyGroup`, `offsetForIndex()`/`indexAtOffset()` and the `lr-scroll` event are
  all expressed against the *same* windowing math, so they agree with each other — but that math is
  estimate-based in `row-height="auto"` mode until the rows involved have been measured. Read a
  position after `await el.updateComplete`, and expect the value to converge rather than be final on
  the first frame.
- A sticky band only appears when `renderStickyGroup` *and* at least one valid `groups` entry are
  both present; `groups` alone renders positioned markers with nothing pinned, and
  `renderStickyGroup` alone renders no overlay element at all.
- **A row that renders a popup needs the active-row lift, and this is why `[part='row']` has one.**
  Each row carries `will-change: transform` (a compositor hint for the per-frame translate), which
  makes every row its own stacking context. Rows otherwise carry no `z-index`, so they paint in DOM
  order and each one paints over the previous. Anything a row renders that overflows its own box —
  an `<lr-menu>` popup in a row-action menu, a tooltip, an outward focus ring — is therefore painted
  *underneath* every following row, no matter how high its own `z-index` is: that `z-index` only
  orders siblings inside the row's own context. The last row always looks correct, which is exactly
  why the failure tends to hide in short lists. A row lifts to `--lr-layer-content` while something
  inside it holds focus or while it contains an open `lr-menu`. The explicit menu-open branch covers
  imperative opening and virtual measurement/render cycles, where focus can temporarily return to
  the document while the popup remains visible. The value deliberately *matches*
  `[part='group']`'s rather than exceeding it, so the two land on the same layer and DOM order
  decides: groups render before the rows, so an active row wins while (and only while) it needs to,
  which is right — a group header is a non-interactive `pointer-events: none` label.

---

## `lr-app-rail`

A responsive navigation rail that adapts across three presentations as the *viewport* narrows (not
this element's own inline size): `'full'` (nav items show icon + label, inline), `'icon-only'` (a
narrower inline rail, icons only), and `'mobile'` (hidden behind a toggle button; opening it shows a
focus-trapped floating overlay over the page). First-party invention (no `wa-*`/`sl-*` counterpart).
Breakpoints are viewport-width `matchMedia()` queries against `icon-only-breakpoint`/
`mobile-breakpoint`, not a `ResizeObserver` on this element — presentation tracks the actual device/
window width the way a native OS shell's navigation does, not however much horizontal space a
particular layout happens to give it. `[part="base"]` (the inline `'full'`/`'icon-only'`
presentation) and `[part="panel"]` (the mobile overlay) are the *same* element promoted in place
across modes (mirrors `<lr-widget>`'s fullscreen mode) — never both at once, and slotted nav
content is never duplicated.

Opting in to `resizable` adds a continuously draggable width for the `'full'` state: a
`[part="resizer"]` handle (pointer-drag and Left/Right-arrow keyboard stepping, RTL-aware) clamped to
`[minRailWidthPx, maxRailWidthPx]`. Set `storageKey` (attribute `storage-key`) to persist the fields
selected by `persist` to `localStorage` under `lr-app-rail:${storageKey}` and restore them on the
next mount (mirrors `lr-split`'s `storage-key`; effective `mode` is breakpoint-derived and never
persisted). The backward-compatible allowlist is `open width`; use
`persist="width preferred-mode"` for durable layout preference without restoring the transient
mobile overlay. Without a `storageKey` there is no persistence — listen for `lr-rail-resize` and
persist `widthPx` yourself.
`preferredMode` separately lets a host manually prefer `'full'`/`'icon-only'` for the non-mobile
breakpoint axis (e.g. a user's own collapse toggle) while `mobile-breakpoint` continues to be tracked
automatically regardless — it's only consulted while `mode` isn't force-pinned via the `mode`
accessor itself, which still takes full priority.

**Properties:**
- `mode: AppRailMode` (custom accessor, reflected) — the getter always returns one of the three real
  modes (`'full'|'icon-only'|'mobile'`), never `'auto'`. The setter accepts
  `AppRailModeInput` (`AppRailMode | 'auto'`): assigning `'full'`/`'icon-only'`/`'mobile'` forces
  that mode and stops the element responding to breakpoint changes; assigning the write-only
  sentinel `'auto'` releases the force and immediately re-syncs to the current viewport width,
  resuming automatic tracking. Settable via the `mode` attribute too (`mode="icon-only"`,
  `mode="auto"`).
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
- `label: string = 'Navigation'` — accessible name for the rail's navigation landmark, and for its
  dialog role while the mobile overlay is open. A host-level `aria-label` attribute (see below)
  takes precedence over this when both are set.
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
  Valid `AppRailPersistField` tokens are `open`, `width` (`railWidthPx`), and `preferred-mode`
  (`preferredMode`). The default preserves the existing open+width behavior. Use
  `persist="width preferred-mode"` when overlay-open state is controlled or should stay
  session-only.
- `minRailWidthPx: number = 190` (attribute `min-rail-width-px`) — minimum `railWidthPx` a
  drag/keyboard resize can reach.
- `maxRailWidthPx: number = 440` (attribute `max-rail-width-px`) — maximum `railWidthPx` a
  drag/keyboard resize can reach.
- `dragging: boolean = false` (reflected) — `true` for the duration of an active pointer-driven
  resize drag (not a keyboard step); reflected so a consumer (or this component's own styles) can
  suppress `[part='base']`'s `transition: inline-size` during the drag, which otherwise visibly
  "chases" the pointer instead of tracking it 1:1. Effectively read-only (this component owns the
  transitions), but a plain reflected property like every other boolean here.

Also settable as a plain `aria-label` attribute (not a reactive property): overrides the computed
`label`/localized-default accessible name on both the navigation landmark and the mobile dialog
role, matching `<lr-date-input>`'s `accessibleLabel`.

**Events:** `lr-mode-change` (`detail: AppRailModeChangeDetail` = `{ mode: AppRailMode }`; the
effective mode changed, whether from a breakpoint crossing or an explicit `mode` assignment — not
fired for a redundant reassignment to the mode already in effect), `lr-toggle`
(`detail: AppRailToggleDetail` = `{ open: boolean }`; the mobile overlay is opening or closing — via
the built-in toggle button, Escape, a backdrop click, a nav-item click while open, or a
breakpoint/forced mode change leaving `'mobile'` while open — not fired when a consumer sets `open`
directly. Cancelable for every trigger except the forced mode-change close, which always applies —
vetoing that one would leave `open` stuck `true` in a mode where it's meaningless; call
`preventDefault()` to keep the overlay as it is for the other triggers),
`lr-rail-resize` (`detail: AppRailResizeDetail` = `{ widthPx: number }`; the `resizable` rail's
width changed via drag or keyboard stepping — not fired when a consumer sets `railWidthPx` directly).

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

**Optional peer deps:** none.

```html
<lr-app-rail label="Main navigation" icon-only-breakpoint="960px" mobile-breakpoint="600px" resizable>
  <span slot="header"><img src="/logo.svg" alt="Acme" /></span>
  <a href="/inbox" aria-label="Inbox"><svg aria-hidden="true">...</svg><span>Inbox</span></a>
  <a href="/settings" aria-label="Settings"><svg aria-hidden="true">...</svg><span>Settings</span></a>
  <span slot="footer"><button>Profile</button></span>
</lr-app-rail>
<script type="module">
  const rail = document.querySelector('lr-app-rail');
  rail.addEventListener('lr-rail-resize', (e) => localStorage.setItem('railWidthPx', String(e.detail.widthPx)));
</script>
```
```ts
rail.mode = 'icon-only'; // force a presentation regardless of viewport width
rail.mode = 'auto';      // release the force, resume live breakpoint tracking
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
- `active: boolean = false` (reflected) — marks this as the destination for the current page/view;
  reflects `aria-current="page"` on `[part='base']` and drives the active visual treatment. The rail
  has no built-in routing, so the consumer sets this per item (e.g. by comparing `href` against the
  current location).
- `tooltip: boolean = false` (reflected) — opt-in hover/focus flyout (`[part='tooltip']`) showing
  this item's label text while the rail's `icon-only` mode (set externally by the parent
  `<lr-app-rail>` as the viewport narrows) hides it from view. No effect outside icon-only mode,
  since the label is already visible there. `false` (the default) reproduces the exact existing
  output.

**Slots:** default (the visible label), `icon` (the leading icon, hidden from assistive technology
when the item has an explicit `aria-label`).

**CSS parts:** `base`, `icon`, `label`, `tooltip` (the hover/focus label flyout, only rendered while
`tooltip` is set, the item is `icon-only`, and it is hovered or focused).

**Themeable custom properties:** `--lr-app-rail-item-current-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-app-rail-item-current-color` (default
`var(--lr-color-brand)`) — background and text/icon color of the `active` (`aria-current="page"`)
item. Both are scoped to `[aria-current='page']` only and declared as inline `var()` fallbacks at
the point of use, never on `:host`, so either can be set on the item itself *or on any ancestor* —
including on `<lr-app-rail>` or a wrapper above it, to tint every item's active state at once.
`::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an attribute selector after
`::part()`), so before these hooks the only lever was overriding the library-wide
`--lr-color-brand-quiet`/`--lr-color-brand` tokens, which repainted every other element reading
them. Unset, each falls back to the token its rule used before.

**Optional peer deps:** none.

---

## `lr-responsive-panel`

The same slotted content either docked inline in the page's normal layout flow (desktop) or
presented as a full-screen/bottom-sheet overlay (mobile), depending on viewport width. First-party
invention (no `wa-*`/`sl-*` counterpart). Typical uses: a settings panel or a conversation-history
sidebar that's a permanent docked pane on a wide screen but a modal on a phone.

**Properties:**
- `open: boolean = false` (reflected) — in the inline presentation this just means visible/mounted;
  in the overlay presentation this is the actual modal open/closed state.
- `mode: ResponsivePanelMode = 'auto'` (reflected) — `'auto'` tracks `mobile-breakpoint` live;
  `'inline'`/`'overlay'` force that presentation regardless of viewport width.
- `variant: ResponsivePanelVariant = 'fullscreen'` (reflected) — only affects the overlay
  presentation's visual treatment: `'fullscreen'` covers the whole viewport; `'bottom-sheet'` slides
  up from the bottom and doesn't cover the full height. Has no visual effect while the effective
  presentation resolves to `'inline'`.
- `label: string = ''` — accessible name for the overlay presentation's `role="dialog"`, used
  verbatim when set. When empty, falls back to the `header` slot's content: a heading element
  (`h1`–`h6` or `[role="heading"]`) among the slotted header content wins if present, otherwise the
  header slot's combined text content is used (mirrors `lr-dialog`'s `detectHeading()` fallback,
  via `aria-label` rather than `aria-labelledby` since the header content is light DOM while
  `[part="panel"]` is in shadow DOM). A panel opened with neither `label` nor header content still
  renders `role="dialog"` with no accessible name. Unused in the inline presentation, which has no
  dialog semantics to name.
- `mobileBreakpoint: string = '768px'` (attribute `mobile-breakpoint`) — CSS length passed to
  `matchMedia` as `(max-width: <this>)` to decide, in `mode="auto"`, whether the effective
  presentation is `'overlay'` (below/at this width) or `'inline'` (above it).

**Methods:** `close(reason: ResponsivePanelCloseReason = 'api'): void` — closes the panel (sets
`open = false`), emits `lr-close` with `reason`, and — only in the overlay presentation — returns
focus to whichever element triggered the open. No-op if already closed. Built-in overlay triggers
call this with `'escape'`/`'backdrop'`; a consumer's own close affordance (a footer button, a docked
panel's own toggle) should call it directly with its own reason string.

**Events:** `lr-close` (`detail: ResponsivePanelCloseReason` = `'escape'|'backdrop'|'api'|string`;
fired by the overlay presentation's built-in dismiss triggers — Escape, backdrop click — and by any
`close()` call, in either presentation; a plain `open = false` property write does **not** fire it,
only going through `close()` counts as a dismissal), `lr-mode-change`
(`detail: ResponsivePanelModeChangeDetail` = `{ mode: ResponsivePanelEffectiveMode }`; fired whenever
the *effective* mode — not the `mode` prop's possibly-`'auto'` literal value — changes between
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
`variant="fullscreen"` or on the inline presentation), plus shared tokens (`--lr-color-border`, `--lr-color-surface`,
`--lr-space-*`, `--lr-radius`, `--lr-shadow`).

**Optional peer deps:** none.

```html
<lr-responsive-panel id="settings-panel" label="Settings" variant="bottom-sheet" mobile-breakpoint="768px">
  <span slot="header"><h2>Settings</h2></span>
  <div>Panel body content — a form, a list, anything.</div>
  <span slot="footer"><button onclick="document.getElementById('settings-panel').close()">Done</button></span>
</lr-responsive-panel>
```

Breakpoint detection uses `matchMedia('(max-width: ' + mobileBreakpoint + ')')`, re-evaluated live
while connected — resizing/rotating a device that crosses the breakpoint while `mode="auto"` (the
default) updates the effective presentation without unmounting or re-creating the slotted content.
Inline and overlay presentations share the same shadow DOM, so slotted content and scroll position
survive the transition. Focus already inside the panel is preserved. If focus is outside when an
open inline panel becomes an overlay, focus moves to the first composed focus target (falling back
to the panel), so it cannot remain behind `aria-modal="true"`. Closing restores the element captured
when the panel originally opened, even when that original open happened inline. The overlay
presentation participates in the shared modal stack rather than nesting a `<lr-dialog>`.

The package root also exports the pure `resolveEffectiveMode(mode: ResponsivePanelMode,
belowBreakpoint: boolean): ResponsivePanelEffectiveMode` resolver — renamed on export to
`resolveResponsivePanelEffectiveMode` to avoid a name collision — alongside the
`ResponsivePanelMode`/`ResponsivePanelEffectiveMode`/`ResponsivePanelVariant`/
`ResponsivePanelCloseReason`/`ResponsivePanelModeChangeDetail` types. It's the same logic the
element's internal `matchMedia` listener calls: `'inline'`/`'overlay'` pass straight through
unchanged; `'auto'` resolves to `'overlay'` when `belowBreakpoint` is true, `'inline'` otherwise —
exposed standalone so a consumer can compute or unit-test the same resolution without a real browser
window.

**Known gotchas:**
- assigning `open` directly still does not emit `lr-close`; use `close()` when the dismissal
  event/reason is required. While overlay chrome is active, however, the `true` → `false` state
  transition restores opener focus regardless of whether it came from `close()`, a property write,
  or attribute removal.
- crossing inline → overlay while already open preserves focus that is already inside and moves
  outside focus into the panel; do not expect focus to remain on page content behind the modal.
- `variant="bottom-sheet"` has no visible effect at all while the effective presentation is
  `'inline'` — it only changes the overlay presentation's anchoring/height.
- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if overlay chrome was still active
  across the move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in
  between, so `willUpdate()` alone wouldn't otherwise notice.
- the exported pure function is named `resolveEffectiveMode` in the component module but re-exported
  from the package root as `resolveResponsivePanelEffectiveMode` — importing the un-prefixed name
  from `@aceshooting/lyra-ui` will fail.

---

## `lr-menu-label`

A non-interactive section heading inside `<lr-menu>`'s default slot. Mirrors `sl-menu-label`.

The host takes `role="presentation"` on connect (a `role="menu"` may only contain menu-item roles,
so a heading with a generic role would make the menu's own children invalid) — unless the consumer
already set a `role`, which is left alone. `<lr-menu>` enumerates its items by `instanceof
LyraMenuItem`, so a label is never enrolled in the roving tabindex and can never become a focus
stop; nothing on `<lr-menu>` has to know this element exists.

To announce a *named group* rather than a caption, wrap the labelled items in an element with
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

An anchored dropdown built around a consumer-supplied trigger element (typically an icon button)
assigned to the `trigger` slot. It is not a first-party invention: the pair mirrors `sl-menu` /
`sl-menu-item`, and `<lr-dropdown-item>` below is the `wa-dropdown-item`-compatible name for the
same item element. Web Awesome's `wa-dropdown` maps to `<lr-dropdown>` in the overlays family; that
component keeps the distinct trigger/popup host while containing this same menu interaction engine,
and accepts direct mapped items or a consumer-supplied `lr-menu`. Either way it is a close,
drop-in-shaped replacement for reaching outside this library for a
third-party dropdown to build a gear menu, an avatar menu, or a history row's overflow menu. Uses
the WAI-ARIA "menu button" pattern —
`role="menu"`/`role="menuitem"` with real roving DOM focus moving between actual focusable
`<lr-menu-item>` rows — deliberately not a `role="listbox"`/`aria-activedescendant` shape (that's
`<lr-select>`'s pattern instead).

### `lr-menu`

**Properties:**
- `open: boolean = false` (reflected)
- `placement?: Placement` (reflected — resolved through `rtlAwarePlacement()` (`internal/rtl.ts`),
  then forwarded to `place()`; defaults to whatever `place()` itself defaults to. A `left`/`right`
  side is mirrored under `dir="rtl"`, so e.g. `placement="left-start"` still anchors to the menu's
  trailing edge instead of pinning to the physical left)
- `label: string = 'Menu'` — accessible name for the `role="menu"` popup; override with something
  specific (e.g. "Row actions") when a page has more than one menu. A host-level `aria-label`
  attribute takes precedence over both this prop and the localized default (unset by default, so
  a no-op for existing consumers), matching `lr-select`/`lr-model-select`'s
  `this.getAttribute('aria-label') || <computed default>` precedence

- `closeOnEscapeAnywhere: boolean = false` (attribute `close-on-escape-anywhere`) — lets Escape
  close the menu when focus is on non-menu-item content slotted into the **default** slot, i.e.
  rendered inside `[part="list"]`; item activation remains scoped to actual menu items. It has no
  bearing on the `header`/`footer` slots, which sit outside the `role="menu"` list and always close
  on Escape — so a menu that keeps its composed controls there never needs this property
- `anchor: HTMLElement | null = null` (property only — an element reference has no attribute form;
  new in 8.0.0) — positions the popup against this element instead of the `trigger` slot's assigned
  element, and, when no `trigger` element is slotted, becomes the element
  `hide({ focusTrigger: true })` returns focus to (a slotted trigger still wins for focus). An
  `<lr-menu-item>` sets it to itself on the menu assigned to its `submenu` slot, which is what turns
  that instance into a submenu: the anchor also switches the default placement from below the
  trigger to beside the anchoring row, and keeps a pointerdown on that row from reading as an
  outside click. Set it by hand to anchor a menu to a trigger this component cannot slot — a canvas
  hit region, a table cell

**Methods:** `show(focus: 'first' | 'last' | 'none' = 'first')` opens the menu and moves roving focus
to the first (or, with `'last'`, the last) non-disabled item; `'none'` opens without moving DOM focus
at all, which is what pointer-driven opening needs. On an already-open menu it applies the focus
target and nothing else, so an arrow key can step into a submenu the pointer opened a moment earlier.
`hide(options?: { focusTrigger?: boolean })` closes it; a no-op when already closed. They are the
imperative pair for the cases the slotted trigger can't express — a "Done"/"Apply" button *inside*
the menu, a keyboard shortcut, a parent restoring UI state — without hand-reproducing the
pending-focus bookkeeping. Both are deliberately thin: positioning, the outside-click listener, the
`lr-show`/`lr-hide` events, and the initial focus move all stay in one place, so **writing `open`
directly is fully supported and equivalent apart from the focus moves**. In particular the
roving-tabindex reset is centralized, so a bare `el.open = false` also clears `activeIndex` and
never leaves a stale `tabindex="0"` tab stop on the last active item. `hide()` never refocuses
unless you ask: pass `{ focusTrigger: true }` for a dismissal with nowhere else for focus to land,
and leave it off when the interaction that closed the menu already put focus somewhere the user
chose (an outside click, a Tab out). Focus restoration lives in `hide()` rather than in the
close branch precisely so teardown — disconnecting an open menu — can't steal focus.

**Events:** `lr-show` (no detail — fires only when `open` transitions to `true`, not for markup
that renders `open` true from the start), `lr-hide` (same first-render guard, opposite
transition), `lr-menu-select` (`detail: { value }` — a consolidated re-fire of the activated
`<lr-menu-item>`'s own `lr-menu-item-select`; retained for Lyra compatibility), and `lr-select`
(`detail: { item }` — the complete activated item; cancelable). Unless `lr-select` is prevented,
selection closes the menu and returns focus to the trigger. A selection made inside a submenu
arrives as the same single `lr-select` event — it is never translated or re-emitted by ancestors —
while the legacy `lr-menu-select` likewise bubbles once to the outermost menu. There is no separate
nested-selection name. A non-vetoed selection closes the whole chain behind it. A submenu's own
`lr-show`/`lr-hide` deliberately stop at the row that owns it, so they are never mistaken for this
menu opening or closing; listen on the nested `<lr-menu>` element itself for those.

**Slots:** `trigger` (the consumer's own trigger element — first assigned element wins if several
are assigned; enhanced imperatively with `aria-haspopup="menu"`/`aria-expanded`/`aria-controls`
since those attributes belong on the actual interactive trigger, which lives outside this
component's shadow root. `aria-controls` targets the `lr-menu` host, which receives a stable
generated id only when the consumer did not provide one, rather than the shadow-private list id.
`lr-button`/`lr-icon-button` forward the popup/expanded values to their focused shadow-internal
native control and resolve the controls element-reference across their shadow boundary. In a
supporting browser, the reflected `ariaControlsElements` list is the source of truth and its setter
intentionally clears the internal control's serialized `aria-controls` value; browsers without the
API retain the string as a best-effort fallback), default
(`<lr-menu-item>` elements, plus optionally plain `<hr>` dividers — native `<hr>` already carries
an implicit `separator` role),
`header` and `footer` (composed, deliberately non-menu-item content — a filter/search field, a
section title, an "Apply"/"Done" button, a count — rendered above/below the items inside
`[part="popup"]` but **outside** the `role="menu"` list. Both collapse to no box at all while
unfilled, so a menu that uses neither renders exactly as it did before they existed)

Put composed controls in `header`/`footer` rather than the default slot. Non-item content in the
default slot still works and is not deprecated at runtime (no warning is emitted), but it sits
inside `role="menu"`, where ARIA permits only
`menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator` children — anything else is an
`aria-required-children` violation. It is also not Tab-reachable from an item, and needs
`closeOnEscapeAnywhere` before Escape will close the menu. The named regions have none of those
problems.

**CSS parts:** `trigger` (wrapper around the `trigger` slot — the positioning anchor), `popup` (the
positioned floating panel), `header` (wrapper around the `header` slot, above the list and outside
`role="menu"`; `display: none` while that slot is unfilled), `list` (the `role="menu"` container
wrapping the default slot), `footer` (wrapper around the `footer` slot, below the list and outside
`role="menu"`; `display: none` while that slot is unfilled)

**Themeable custom properties:** shared tokens only (`--lr-color-surface`, `--lr-color-border`,
`--lr-radius`, `--lr-shadow`, `--lr-space-xs`, `--lr-transition-fast`).

**Optional peer deps:** none.

**Which items arrow keys reach.** An item is navigable unless it is `disabled` (or `loading`),
`hidden`, `aria-hidden="true"`, **`inert`, or has an `inert` ancestor** — the last two alongside the
rest because an inert element *refuses* focus: stepping the roving `tabindex` onto one leaves
`focus()` a silent no-op, so roving focus stays wherever it was (or falls to `<body>`) and every
later arrow press dies. The state is observed live —
`attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'inert']` on every item — so marking the
*currently active* item inert rehomes roving focus to the next reachable one instead of leaving a
stale `tabindex="0"` on an unfocusable row. `lr-tab-group`, `lr-tree` and `lr-video-playlist` mirror
the same rule for their own roving navigation, with one deliberate difference: those three read only
a child's **own** inertness (plus, in `lr-tree`, an inert ancestor *inside* the tree), because a list
inerted wholesale by an open modal must not lose its selection and its tab stop for as long as the
dialog is up — focus cannot be inside it anyway. A menu is itself the overlay, so it takes the
simpler ancestor-inclusive read.

### `lr-menu-item`

Not meaningful standalone — it exists purely as `<lr-menu>`'s light-DOM child, the same
relationship `<lr-option>` has to `<lr-combobox>`/`<lr-select>`. `role="menuitem"` and the
roving `tabindex` both live on the host element itself (mirroring `<lr-tree-item>`), not an
internal shadow-DOM button; `<lr-menu>` is the sole owner of this element's `tabIndex`.

**Properties:**
- `value: string = ''` — an id/value echoed back in the parent `<lr-menu>`'s `lr-menu-select`
  detail
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'` (reflected, new
  in 8.0.0) — row density on the library's shared size ladder, the same one `<lr-input>`/
  `<lr-select>`/`<lr-button>` use, so a menu sitting under a compact toolbar can match it. It scales
  the row's height, inline/block padding, font size and corner radius together; both spellings of
  every tier are accepted. Every tier still floors the row at the shared 24px pointer-target
  minimum, so even `2xs` stays tappable. The size lives on the **item**, not on `<lr-menu>`, so a
  single compact row inside an otherwise default menu needs no wrapper — and, conversely, sizing a
  whole menu means setting it on every item
- `disabled: boolean = false` (reflected — disables selection and excludes this item from
  `<lr-menu>`'s roving-tabindex navigation entirely; the native `inert` attribute, `hidden`, and
  `aria-hidden="true"` exclude it the same way — see "Which items arrow keys reach" above)
- `destructive: boolean = false` (reflected — tints the row with `--lr-color-danger`, for a
  dangerous action like "Delete"; retained as a behavior-identical alias)
- `variant: LyraVariant | 'default' = 'default'` (reflected) — `danger` is the mapped dangerous
  treatment; `default` is the WA spelling of Lyra's neutral item treatment
- `type: 'normal' | 'checkbox' = 'normal'` — `'checkbox'` (mirroring `wa-dropdown-item`'s identical
  `type` option) renders `role="menuitemcheckbox"` in place of `role="menuitem"`, with `aria-checked`
  reflecting `checked` and a checkmark glyph shown once `checked` is `true`. `'normal'` (the default)
  renders and behaves exactly as before this option existed.
- `checked: boolean = false` (reflected) — whether a `type="checkbox"` item is checked; meaningless
  (ignored) for `type="normal"`
- `loading: boolean = false` (reflected) — renders the spinner parts, announces the row as
  `aria-disabled="true"`, and excludes it from activation/roving focus until loading clears
- `hasSubmenu: boolean` (read-only, new in 8.0.0) — whether an `<lr-menu>` or direct mapped items are
  currently assigned to this item's `submenu` slot, making the row a submenu parent
- `submenuOpen: boolean = false` (new in 8.0.0) — whether that submenu is open right now. Assigning
  it drives the same panel as `openSubmenu('none')` / `closeSubmenu()` without moving focus, and is
  a no-op until submenu content is connected. It also tracks the panel's own state however it
  changed: the parent menu's keyboard or pointer handling, a dismissal, an ancestor closing, or a
  direct `panel.open = false`. Transient, like every other open-state in this library — it resets
  to `false` when the item is disconnected

**Methods:** `select(): void` — fires `lr-menu-item-select` (no-op while `disabled` or `loading`). Called
internally by this element's own click handler and by `<lr-menu>`'s Enter/Space keydown handling
of the roving-focused item; also the cleanest way for a consumer/test to trigger selection
programmatically instead of clicking the shadow-DOM `[part="base"]` element (see the gotcha below).
For `type="checkbox"`, also toggles `checked` and fires `lr-menu-item-change` first. On a submenu
parent it opens the submenu instead and fires neither event — see below.

`openSubmenu(focus: 'first' | 'last' | 'none' = 'first'): Promise<void>` and
`closeSubmenu(): Promise<void>` drive the assigned/generated panel and resolve after its matching
state and update settle. `openSubmenu()` is a resolved no-op without a `submenu` slot or while
`disabled`/`loading`; it uses the same focus vocabulary as `<lr-menu>`'s own `show()` — `'first'`
for keyboard activation, `'none'` for pointer intent, which must not pull focus out from under the
keyboard.
Re-opening an already-open submenu still applies the focus target, so the into-submenu arrow key
moves into a submenu the pointer opened a moment earlier. `closeSubmenu()` closes the panel and,
through it, everything below it; it leaves focus alone, because the caller that moved focus knows
where it belongs. The parent `<lr-menu>` owns the interaction policy (arrow keys, pointer intent,
one-submenu-per-level) and drives it through exactly these two methods, so calling them by hand
behaves identically.
`getTextLabel(): string` returns the visible label used by type-ahead and Shoelace-compatible
integrations, without including nested submenu text.

**Events:** `lr-menu-item-select` (no detail payload — `this.emit('lr-menu-item-select')` is
called with no second argument, so `event.detail` is `null`, not `undefined`; fires on click, or
when the parent `<lr-menu>`'s own Enter/Space keydown handling calls `select()` on the currently
roving-focused item; never fired by a submenu parent, which is a disclosure rather than an action),
`lr-menu-item-change` (`detail: { value, checked }` — fired when a
`type="checkbox"` item is activated and its `checked` state toggled, in addition to — never instead
of — `lr-menu-item-select`; never fired for `type="normal"`, and never fired by a submenu parent,
whose activation opens the panel instead of toggling `checked`),
`lr-menu-item-state-change` (`detail: { disabled, hidden }` — emitted when either navigability
state changes so the parent menu can repair its roving-tabindex state immediately)

**Slots:** default (label), `icon` and Shoelace-compatible `prefix` (leading content), `details`
(WA secondary text), `suffix` (Shoelace trailing content), and `submenu` (either a nested
`<lr-menu>` or direct mapped menu items).

**CSS parts:** `base`; `icon` and `prefix`; `label`; `details`; `suffix`; `checkmark` and its
Shoelace-compatible `checked-icon` wrapper; `spinner spinner__base`; `submenu-icon`; and `submenu`.
The role remains on the host, not `base`; the submenu chevron mirrors under RTL through its wrapper.

**Themeable custom properties:** `--submenu-offset` (default `-2px`) is the final signed distance
between a submenu and its parent row: negative values overlap the parent menu and positive values
add separation. It updates live, mirrors along with the submenu under RTL, and applies to both the
Shoelace-style nested-menu shape and Lyra's generated panel for direct mapped items. Shared tokens
also include `--lr-radius`, `--lr-focus-ring-width`, `--lr-focus-ring-color`, `--lr-space-xs`,
`--lr-space-s`, `--lr-color-brand-quiet`, `--lr-opacity-disabled`, `--lr-color-danger`, and
`--lr-color-danger-quiet`.

**Optional peer deps:** none.

### `lr-dropdown-item`

Compatibility naming alias for `<lr-menu-item>`, mirroring `wa-dropdown-item`. It is a subclass of
the same implementation, so `value`, `size` (including the `small`/`medium`/`large` spellings),
`disabled`, `loading`, `variant="danger"`/`destructive`, `type`, `checked`, `select()`,
`getTextLabel()`, `hasSubmenu`/`submenuOpen`, async `openSubmenu()`/`closeSubmenu()`, checkbox events,
and menu roving focus behave identically.

On this mapped tag, `submenuOpen: boolean = false` also reflects to `submenu-open`, and changing the
attribute drives the same submenu state as assigning the property. `openSubmenu()` defaults to
focusing the first item; Lyra's optional `'first' | 'last' | 'none'` argument remains available,
with `'none'` appropriate for pointer or declarative control that must not steal focus.

**Events:** the focusable host emits the platform's native `focus` and `blur` `FocusEvent`s. They
are non-bubbling, composed, and non-cancelable, with no prefixed duplicates. The inherited
`lr-menu-item-select`, `lr-menu-item-change`, and `lr-menu-item-state-change` contracts are described
under `<lr-menu-item>` above.

**Slots:** default, `icon`, `prefix`, `details`, `suffix`, and `submenu` — including WA's direct-item
submenu shape and Shoelace's nested-menu shape.

**CSS parts:** identical to `<lr-menu-item>`'s, including all compatibility aliases above.

**Themeable custom properties:** identical to `<lr-menu-item>`'s, including `--submenu-offset`.

```html
<lr-menu>
  <button slot="trigger">Actions</button>
  <lr-dropdown-item value="archive">Archive</lr-dropdown-item>
</lr-menu>
```

```html
<lr-menu label="Row actions">
  <button slot="trigger" aria-label="More actions">⋮</button>
  <lr-menu-item value="edit">Edit</lr-menu-item>
  <lr-menu-item value="duplicate">Duplicate</lr-menu-item>
  <hr />
  <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
</lr-menu>
<script type="module">
  document.querySelector('lr-menu').addEventListener('lr-select', (e) => console.log(e.detail.item.value));
</script>
```

The popup is always rendered in the DOM (never `display:none`) so `.focus()` calls on its content
work synchronously the instant it opens — closed state is conveyed via `visibility`/`opacity`
instead. `visibility` is an inherited CSS property that pierces the `<slot>` projection boundary, so
every closed-state `<lr-menu-item>` is automatically excluded from sequential (Tab-key)
navigation with no separate JS bookkeeping. ArrowDown/ArrowUp *on the trigger while closed* also
opens the menu, focusing the first/last non-disabled item respectively (mirrors native `<select>`).
Once open, ArrowDown/ArrowUp move the roving focus among non-disabled items and wrap past either end
(unlike `<lr-select>`'s clamped listbox nav); Home/End jump to the first/last non-disabled item;
Enter/Space activate the focused item; Escape closes and refocuses the trigger. The arrow keys,
Home/End, Enter/Space and type-ahead only respond when the triggering keydown event's own target is
an actual `<lr-menu-item>` element; a keydown bubbling up from any other node inside the popup is
ignored rather than misread as list navigation. Escape and Tab are the two deliberate exceptions.
Escape from `header`/`footer` content always closes the menu and refocuses the trigger (mirroring
`lr-popover`'s handling of arbitrary popup content), while Escape from non-item content in the
*default* slot closes it only with `closeOnEscapeAnywhere` set. Tab never traps focus and never
calls `preventDefault()` — the browser's own Tab navigation always proceeds untouched — and closes
the menu only when focus is on its way *out* of `[part="popup"]`: with a focusable in the
`header`/`footer` region on the far side of the keypress the menu stays open so native Tab can carry
focus there, and with neither region filled Tab closes exactly as it always has. Tabbing past the
popup's last focusable in either direction closes the menu, including from slotted non-item content
— which previously left the menu open while focus walked out of the popup entirely. A printable
keypress runs type-ahead: roving focus jumps to the next non-disabled item whose text starts with the
accumulated buffer (cycling from just after the active item, buffer resets ~500ms after the last
keystroke) — mirrors `<lr-select>`'s identical listbox type-ahead. A click outside both the trigger
and the open popup also closes it, but deliberately does *not* refocus the trigger — the outside
click itself already moved focus somewhere the user chose.

### Nested submenus (new in 8.0.0)

Both upstream shapes use the same slot assignment. Shoelace-style markup puts an `<lr-menu>` inside
an item with `slot="submenu"`; that nested menu needs no trigger because the row becomes its anchor.
Web Awesome-style markup assigns one or more direct mapped items to `slot="submenu"`; Lyra creates
the contained submenu panel around them. Both reach the same keyboard/pointer engine, and nesting is
unbounded.

```html
<lr-menu label="Row actions">
  <button slot="trigger" aria-label="More actions">⋮</button>
  <lr-menu-item value="rename">Rename</lr-menu-item>
  <lr-menu-item value="share">
    Share
    <lr-menu slot="submenu">
      <lr-menu-item value="email">Email</lr-menu-item>
      <lr-menu-item value="link">Copy link</lr-menu-item>
    </lr-menu>
  </lr-menu-item>
</lr-menu>
<script type="module">
  // One cancelable event for the whole tree, submenu selections included.
  document
    .querySelector('lr-menu')
    .addEventListener('lr-select', (e) => console.log(e.detail.item.value));
</script>
```

The equivalent direct-item branch is:

```html
<lr-dropdown-item>
  Share
  <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
  <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
</lr-dropdown-item>
```

**Semantics.** A row with a `submenu` slot gains `aria-haspopup="menu"` and an `aria-expanded` that
renders `"true"` *and* `"false"` — never omitted, since the attribute is part of the role's state.
The open state also reflects as `submenu-open`, and the chevron renders in
`[part="submenu-icon"]`. Because such a row is a disclosure rather than an
action, activating it opens the submenu and fires no `lr-menu-item-select`; activating one also
never toggles `checked` or fires `lr-menu-item-change`, so `type="checkbox"` still renders
`role="menuitemcheckbox"` (and a checkmark for a `checked` row) but nothing ever moves that state. The submenu's `role="menu"` is named from the row's own label text, and so is the row
itself — otherwise name-from-content would walk into the open submenu and announce "Share Email Copy
link". A host `aria-label` on the row, or a `label`/`aria-label` on the nested `<lr-menu>`, wins over
both computed names.

**Keyboard.** The into-submenu and back-out keys are inline-direction moves, so **both swap under
RTL**: ArrowRight opens the submenu and focuses its first item under LTR while ArrowLeft closes it
and returns focus to the parent row, and under `dir="rtl"` those two keys trade places exactly —
ArrowRight then opens nothing at all on a submenu parent. Enter/Space open a submenu parent too,
landing on the same first item. The back-out key acts only in a menu that has an `anchor` — a
submenu always does; an ordinary trigger-slotted menu does not, and there the key is left untouched
for the browser's own handling. Escape inside a submenu closes only that submenu and
returns focus to its parent row — the innermost open menu is the one holding focus, so it handles
the key and every ancestor declines; a second Escape then closes the level above it. ArrowUp/
ArrowDown, Home/End and type-ahead inside a submenu stay inside that submenu and never disturb the
outer menu's roving highlight. A selection anywhere in the chain closes every level and returns
focus to the outermost trigger.

**Pointer.** Hovering a submenu parent opens its submenu after a short intent delay (150 ms), so
sweeping the cursor down a list opens nothing; leaving closes it after a deliberately longer one
(300 ms), which is the tolerance that lets the cursor cut diagonally across the rows in between on
its way to the panel — and, because the close delay outlasts the open delay, crossing a *sibling*
submenu parent in transit neither dismisses the open submenu nor opens the sibling's. Hover never
moves focus — the pointer opens a submenu, it does not claim the keyboard. A pointerdown on the row
that owns an open submenu is not treated as an outside click. In a test, wait past both delays with
real timers rather than stubbing them.

**Placement and lifecycle.** A submenu prefers the inline-end side of its row, mirrored under RTL
and flipped to the other side by the positioner when the preferred one would overflow. At most one
submenu per level is open at a time — moving the roving highlight or the pointer to another row
closes what the previous one had open — and closing a menu closes everything below it. A disabled
row never opens its submenu, by keyboard or by pointer.

**Known gotchas:**
- A supporting browser reports `trigger.shadowRoot`'s focused control
  `getAttribute('aria-controls') === ''` after the element-reference relationship is assigned.
  Inspect `ariaControlsElements` instead. This is the platform's reflected-element-reference
  contract, not a missing menu id; setting the string again would discard the cross-shadow
  relationship. Browsers without that API keep the string fallback, and `aria-controls` itself is
  optional for the menu-button pattern.
- `<lr-menu-item>`'s click handler lives on an inner shadow-DOM element (`[part="base"]`), not the
  host — calling `.click()` directly on the `<lr-menu-item>` host element in a test does **not**
  trigger selection; either click (or dispatch on) the element returned by
  `menuItemEl.shadowRoot.querySelector('[part="base"]')`, or just call the item's own `select()`
  method directly.
- `lr-show`/`lr-hide` are suppressed on the very first render even if `open` is already `true`
  in markup — only later `open` transitions fire them.
- `lr-menu-item-select` carries no detail payload (`event.detail === null`); read
  `event.target.value` instead. `<lr-menu>`'s own re-fired `lr-menu-select` is the one that
  carries `detail: { value }`.
- Tab never calls `preventDefault()` and never traps focus — the browser's own default Tab
  navigation always proceeds untouched. It closes the menu only when Tab would leave
  `[part="popup"]` entirely; when the `header`/`footer` region holds a focusable on the far side of
  the keypress, the menu stays open instead and native Tab moves focus into it. With neither region
  filled, Tab closes exactly as before.
- Non-item content in the *default* slot is not Tab-reachable from an item — Tab from an
  `<lr-menu-item>` still closes the menu when there is no `header`/`footer` focusable to move to,
  even if a `<button>` is slotted alongside the items. Move such controls to `header`/`footer`.
- `header`/`footer` emptiness is tracked from each slot's own `slotchange` and reflected on the host
  as `data-has-header` / `data-has-footer` (plus `data-list-empty`, which suppresses the region
  divider next to an empty list). They are internal styling hooks, not public API — don't set them
  by hand — but they are why `[part="header"]`/`[part="footer"]` collapse cleanly: a
  `[part]:empty` rule can never match a part that contains a slot, since Chromium counts the
  whitespace-only text nodes Lit leaves there.
- Only Escape and a committed selection refocus the trigger on close; a click outside does not.
- A submenu's own `lr-show`/`lr-hide` stop at the `<lr-menu-item>` that owns it and never reach the
  ancestor menu, where a listener would read them as *that* menu opening or closing. Add the
  listener to the nested `<lr-menu>` element itself.
- There is no nested-selection event. `lr-select` and the retained `lr-menu-select` each originate
  once at the owning menu and bubble through ancestors; listening for a second, deeper name will
  never fire. Preventing `lr-select` leaves the full chain open.
- `submenuOpen` is transient state, not persisted: disconnecting an `<lr-menu-item>` (a drag-and-drop
  reparent, a list re-render) resets it to `false`, so a reconnect never comes back already expanded.
- The `submenu` slot confers submenu semantics on either one nested `<lr-menu>` or direct
  `lr-menu-item`/`lr-dropdown-item` children. Other content still renders but gets no submenu
  semantics.

---

## `lr-dock-panel`

A single panel docked to one edge of whatever contains it, resizable by dragging its inner edge.
First-party invention (no `wa-*`/`sl-*` counterpart). Unlike `lr-split` (which owns and lays out N
sibling panels, and requires restructuring a layout so every panel becomes its direct child), this is
one self-contained element you drop next to your existing content — typically as an absolutely-
positioned child of a `position: relative` parent, or as a flex item alongside a main-content sibling.
It deliberately imposes no `position`/`inset` of its own: it only manages its own size along the
resize axis (`inline-size` for `start`/`end`, `block-size` for `top`/`bottom`) and fills 100% of the
cross axis, leaving where it sits in the page entirely up to the consumer's own layout. `lr-split`
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
  there's no parent, e.g. not yet connected), so the panel still can't be dragged wider/taller than
  its container.
- `collapsible: boolean = false` (reflected)
- `collapsed: boolean = false` (reflected)
- `resizable: boolean = true` (reflected) — when `false`, no drag handle renders at all and the panel
  is a fixed size. Its string-aware converter accepts `resizable="false"` as false despite the
  true default. A Lit property binding (`.resizable=${false}`) also disables it; a false
  boolean-attribute binding (`?resizable=${false}`) only removes the attribute and cannot override
  a true-defaulting property.

**Renamed in 8.0.0: `size`/`min-size`/`max-size` are now `extent`/`min-extent`/`max-extent`**, and
`lr-resize`'s detail key moved with them (`{ size }` → `{ extent }`). Everywhere else in the library
`size` names a tier on the shared six-step ladder; here it was an arbitrary CSS length, which is the
collision the rename resolves. It is a clean rename with no alias, and it fails quietly in both
directions: `size="320px"` is now an unknown attribute the browser ignores, so the panel silently
renders at the `280px` default, and `event.detail.size` reads `undefined`. Rename the attributes and
the detail key in the same change.

**Exported helper:** `parseLengthPx(length: string, containerPx: number, fontSizeEl: Element =
document.documentElement): number | undefined` — resolves an arbitrary CSS length (`px`, `rem`, `em`,
`vw`, `vh`, `%`, or a bare/unitless number treated as `px`) to a live pixel value without a DOM-probe
measurement, since `min-extent`/`max-extent` are pure constraints that are never themselves rendered
anywhere. `rem` resolves against the document root's font size; `em` resolves against `fontSizeEl`'s
own computed font size; `%` resolves against `containerPx`. Returns `undefined` for an
empty/unparseable string. Used internally to resolve `min-extent`/`max-extent`; the panel's
*current* extent is instead always read back live from `getBoundingClientRect()`, which handles any
unit for free.

**Events:**
- `lr-resize` — `detail: { extent }` (a `px` CSS length string), fired on every drag step, drag
  release, and keyboard step.
- `lr-collapse-change` — `detail: { collapsed }`, fired whenever the collapse toggle flips
  `collapsed`.

**Slots:** default — the panel's own content.

**CSS parts:** `base` (the panel root), `content` (wraps the default slot; hidden while `collapsed`),
`handle` (the draggable resize edge; only rendered when `resizable` and not `collapsed`),
`collapse-toggle` (only rendered when `collapsible`)

**Themeable custom properties:** `--lr-dock-panel-collapsed-size` (default
`var(--lr-icon-button-size)`) — the persistent "rail" width/height the panel holds at while
`collapsed`, rather than collapsing to zero (a zero-size collapsed panel would have nowhere to host
the re-expand toggle); component-specific since collapse never zeroes the box. Plus shared tokens
`--lr-color-surface`, `--lr-color-border`, `--lr-color-brand`, `--lr-color-brand-quiet`,
`--lr-color-text`, `--lr-radius`, `--lr-space-xs`, `--lr-focus-ring-width/-color/-offset`,
`--lr-transition-fast`, `--lr-icon-button-size`.

**Optional peer deps:** none.

```html
<div style="position: relative; block-size: 100vh;">
  <lr-dock-panel
    edge="end"
    extent="320px"
    min-extent="200px"
    max-extent="480px"
    collapsible
    @lr-resize=${(e) => console.log(e.detail.extent)}
    @lr-collapse-change=${(e) => console.log(e.detail.collapsed)}
  >
    <div>Sidebar content — a chat thread list, an inspector, anything.</div>
  </lr-dock-panel>
</div>
```

Pointer-drag-resize mirrors `lr-split`'s pointer-capture technique (`pointerdown` captures the
pointer on the handle; `pointermove` computes a new size; `pointerup`/`pointercancel`/
`lostpointercapture` all release it, since a drag can end without a clean `pointerup`) but reasons in
raw pixels throughout rather than percent. Every resize — drag step, drag release, or a keyboard step
(<kbd>ArrowLeft</kbd>/<kbd>ArrowRight</kbd> for the inline axis, <kbd>ArrowUp</kbd>/<kbd>ArrowDown</kbd>
for the block axis, 16px per step) — always commits `extent` as a rounded `px` string regardless of
what unit `extent`/`min-extent`/`max-extent` were originally expressed in.

**Known gotchas:**
- `collapsed` doesn't zero the panel's box — it shrinks to the persistent rail size
  (`--lr-dock-panel-collapsed-size`). `extent` itself is left untouched while collapsed, so
  re-expanding restores exactly what it was.
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
- `orientation: 'horizontal' | 'vertical' = 'vertical'` (reflected) — vertical renders media,
  header/actions, body, and footer/footer-actions as sections. Horizontal arranges media/image,
  body, and `actions` in logical order and stacks them when the card's own container drops below
  30rem.
- `withHeader`, `withHeaderActions`, `withMedia`, `withFooter`, and `withFooterActions` (boolean,
  reflected as `with-header`, `with-header-actions`, `with-media`, `with-footer`, and
  `with-footer-actions`) — SSR presence hints. They expose an otherwise-empty section wrapper before
  slot assignment can be measured; populated slots are still detected automatically after hydration.
- `interactive: boolean = false` (reflected) — opt-in clickable-tile behavior: the hover/focus-visible
  treatment (border-color shift, `cursor: pointer`) plus, when `href` is **not** also set, real
  activation semantics. Those come from a real native `<button part="activation-button">` stretched
  across the card, not from making `[part='base']` itself focusable: it is the keyboard tab stop,
  it answers Enter and Space natively, and activating it emits `lr-card-activate`. With `href` set,
  the root is already a real `<a>`, so native navigation *is* the activation, no activation button
  renders, and `lr-card-activate` never fires. `false` (the default) reproduces a plain static card:
  no button, no listeners, no events.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — the accessible name of that
  activation button. Left unset it falls back to the card's own text content, so a text card is
  named without extra markup; set it explicitly for a card whose content is an image or a chart.
- `href?: string` — when set, the card's root renders as a real `<a href=...>` instead of a `<div>`,
  for a whole-card link (e.g. a wide CTA tile). Unset (the default) renders a plain `<div>`.
- `target?: string` — native anchor target, applied only while `href` resolves to a link. Setting it
  to `'_blank'` (or any other target) automatically derives `rel="noopener noreferrer"` on the
  rendered anchor; there is deliberately **no** separately-settable `rel` property, so a consumer
  can't forget it and leave the opened page holding a `window.opener` back-reference
  (reverse-tabnabbing). Unset (the default) emits neither `target` nor `rel`.

**Events:** `lr-card-activate` (no detail) — the whole card was activated, by a click anywhere on it
or by Enter/Space on `[part='activation-button']`. Only fired while `interactive` is set **without**
`href`. Never fired for an interaction that originated in a slotted control, so a card can keep its
own action buttons (see the gotchas below).

**Slots:** default (the card body), `header` (vertical header content), `media` and `image` (aliases
for media above the header vertically or at logical start horizontally), `footer` (vertical footer
content), `header-actions` and `footer-actions` (controls aligned with those vertical sections), and
`actions` (horizontal-card actions; retained as the legacy header-actions spelling vertically).

**CSS parts:** `base` (the outer container — a `<div>`, or an `<a>` when `href` is set),
`activation-button` (the native whole-card action, rendered only while `interactive` without `href`;
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

**Optional peer deps:** none.

```html
<lr-card appearance="outlined" interactive href="/reports/42" with-media with-header>
  <img slot="image" src="/thumb.png" alt="" />
  <span slot="header">Q3 Report</span>
  <span slot="header-actions"><lr-chip tone="success">Ready</lr-chip></span>
  Revenue up 12% quarter-over-quarter.
  <span slot="footer">Updated 2 days ago</span>
  <button slot="footer-actions" type="button">Download</button>
</lr-card>
```

**Known gotchas:**
- every `appearance` renders on the *same* `[part="base"]` element — there's no separate element per
  variant, so a `::part(base)` override applies uniformly regardless of `appearance`.
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
  a *container* — it routinely holds slotted buttons and links — and `role="button"` around
  focusable descendants is the `nested-interactive` accessibility violation this library's own a11y
  gate enforces. (`lr-chip`'s `toggleable` mode *can* carry `role="button"` because it forbids
  focusable children outright.) The whole-card action is therefore a *sibling* of the slotted
  content — `[part='activation-button']` — so the actionable roles are never nested inside one
  another, and the card still announces as a real button rather than as an unnamed focusable region.
- because the base element carries no `role="button"` to disambiguate, "did the user aim at the card
  or at a control inside it?" is answered at event time: the composed path from the original target
  up to `[part='base']` is walked, and `lr-card-activate` is suppressed if anything along the way is
  itself a control (a link, `button`, `input`, `select`, `textarea`, `label`, `summary`,
  `contenteditable`, anything carrying a `tabindex` other than `-1`, or an ARIA widget role such as
  `button`/`link`/`checkbox`/`switch`/`radio`/`menuitem`/`option`/`tab`/`textbox`/`slider`/
  `spinbutton`). Using the *composed*
  path is what makes this work through a slotted component's own shadow root — a click on
  `<lr-button>` retargets to the host, but its composed path still contains the internal native
  `<button>`.
- a click whose composed path starts on `[part='activation-button']` skips that walk entirely and
  always activates — it *is* the whole-card action, so there is nothing to disambiguate.

---

## `lr-command-palette`

Searchable application command menu. Renders nothing at all while closed. Uses the same shared
overlay infrastructure as `lr-dialog` (focus-trapping Tab, Escape dismissal, backdrop-click
dismissal, ref-counted document scroll lock).

**Properties:**
- `open: boolean = false` (reflected)
- `commands: LyraCommand[] = []` (attribute: false) — `{ id, label, description?, group?, shortcut?,
  keywords?, disabled?, icon?, onSelect? }`. `icon` is an optional leading glyph (a `TemplateResult`,
  an emoji string, etc. — not restricted to a square icon) rendered in the `icon` part before the
  label; a command with no `icon` renders no `icon` part at all. Filtering is case-insensitive
  substring matching over `label` + `description` + `group` + `keywords` joined together (not
  fuzzy/subsequence), memoized per `commands` array identity — reassign the array, never mutate it
  in place. Consecutive commands sharing a `group` render one `[part='group']` heading, so pre-sort
  by group yourself.
- `shortcut: string = 'mod+k'` — global toggle chord parsed as `+`-separated parts; `mod` resolves to
  Cmd on Mac and Ctrl elsewhere. The listener is on `window`, added in `connectedCallback`.
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides the localized dialog name

**Methods:** `openPalette()` (clears the query and resets the active row; no-op if already open),
`close()`, `registerCommand(command)` — appends to `commands` and returns an unregister function.

**Keyboard:** ArrowUp/ArrowDown move the active option, skipping `disabled` rows and clamping (not
cycling) at the ends; the active row is scrolled into view. Enter selects. Hovering a non-disabled
row also makes it active.

**Events:** `lr-open`, `lr-close` (both `detail: undefined`), `lr-select` (`detail: { command }`,
fired before the command's own `onSelect` runs and before the palette closes).

**Slots:** none.

**CSS parts:** `backdrop`, `dialog` (the `role="dialog" aria-modal="true"` panel), `search` (the
input row), `input` (the `type="search"` field), `list` (the `role="listbox"`), `group` (a group
heading), `command` (a `role="option"` button), `icon` (a command's leading icon glyph; only
rendered when the command has one), `description`, `shortcut`, `empty`.

**Themeable custom properties:** `--lr-command-palette-z-index` (default
`var(--lr-overlay-stack-index, var(--lr-layer-modal))`), `--lr-command-palette-offset-block-start`
(default `12vh` — how far down the viewport the dialog sits), `--lr-command-palette-max-inline-size`
(default `var(--lr-size-48rem)`), `--lr-command-palette-max-block-size` (default `70vh`),
`--lr-command-palette-list-max-block-size` (default `50vh` — the scrolling result list), and
`--lr-command-palette-active-bg` (default `var(--lr-color-brand-quiet)` — the background of the
active, keyboard-highlighted command row). That last one is an inline `var()` fallback at the point
of use rather than a `:host` declaration, so it can be set on the element *or on any ancestor*:
`::part(command)[data-active='true']` is invalid CSS (Shadow Parts forbids an attribute selector
after `::part()`), so highlighting the active row previously required hijacking the library-wide
`--lr-color-brand-quiet` token and repainting everything else that read it. Unset, it falls back to
that token, so rendering is unchanged.

**Additional API surface:**

- `part="command-group"` — A labeled ARIA group containing visible command options.
- `part="list-spacer"` — Virtual result extent inside the scrolling list.
- `--lr-command-palette-row-height` — Virtual command-row height. Default: `var(--lr-size-3rem)`.
- `--lr-command-palette-group-height` — Virtual group-heading height. Default: `var(--lr-size-2rem)`.

## `lr-details`, `lr-accordion`, and `lr-accordion-item`

`lr-details` is a native-semantics disclosure panel; it mirrors `wa-details` / `sl-details`.
`lr-accordion` and `lr-accordion-item` mirror `wa-accordion` / `wa-accordion-item`: the group owns
mode, presentation, lifecycle events, and roving focus, while each item renders a heading button
and animated panel. An item also retains the previous Details vocabulary as aliases, and an
accordion still accepts direct `lr-details` children, so existing markup remains operable while new
markup can use the full accordion API.

**Accordion properties:**

- `mode: 'single' | 'single-collapsible' | 'multiple' = 'multiple'` (reflected). `multiple` allows
  any number of expanded items. `single` permits at most one and activating the expanded item is a
  no-op. `single-collapsible` permits at most one but allows zero.
- `multiple: boolean = true` (reflected compatibility alias). `true` selects `mode="multiple"`;
  `false` selects `mode="single-collapsible"`. The true default stays absent while false serializes
  as `multiple="false"`, so declarative false is unambiguous. When both attributes occur in initial
  markup, the explicit `mode` value wins, so their interpretation does not depend on attribute
  order.
- `iconPlacement: 'start' | 'end' = 'end'` (attribute `icon-placement`, reflected),
  `headingLevel: string = '3'` (attribute `heading-level`, reflected; `1`–`6` select that heading,
  `none` omits it, and every other value renders the documented h3 fallback), and
  `appearance: 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'` (reflected). The
  group applies all three to each direct `lr-accordion-item` whenever children or properties
  change.

**Accordion-item properties:** `label: string = ''`, `expanded: boolean = false` (reflected),
`disabled: boolean = false` (reflected), plus the same `iconPlacement`, `headingLevel`, and
`appearance` properties listed above. `open` is a synchronized reflected alias for `expanded`, and
`summary` is a text alias for `label`; the canonical value wins when both text properties are set.
Items also retain the Details `size` property.

**Details properties:** `open: boolean = false` (reflected), `disabled: boolean = false`
(reflected), `summary: string = ''`, `name: string = ''` (reflected — disclosures with the same
non-empty name in one document or shadow root are mutually exclusive),
`appearance: 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'` (reflected),
`iconPlacement: 'start' | 'end' = 'end'` (attribute `icon-placement`, reflected and logical), and
`size`.

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
- Accordion item: `expand()`, `collapse()`, and `toggle()` initiate the corresponding transition and
  return `void`; observe `lr-after-expand` / `lr-after-collapse` on the owning accordion (or the
  retained Details after-events on the item) for completion. Disabled items are unchanged.
  `focus()`, `blur()`, and `click()` forward to the trigger button.
- Details and compatibility aliases on accordion item: `show(): Promise<void>` expands and
  `hide(): Promise<void>` collapses. Each promise settles after its matching `lr-after-show` or
  `lr-after-hide`; a vetoed, disabled, or already-satisfied request resolves without changing state.
  Assigning `open` runs the same Details lifecycle. `show()` is a no-op while disabled; `hide()`
  can still close a disabled Details panel. On an item, prefer `expand()` / `collapse()` when the
  disabled guard and canonical accordion vocabulary matter.

**Events:**

- `lr-expand`, `lr-collapse`, `lr-after-expand`, `lr-after-collapse` — accordion group lifecycle.
- `lr-show`, `lr-hide`, `lr-toggle`, `lr-after-show`, `lr-after-hide` — Details lifecycle, also
  retained by accordion items.

On the accordion, `lr-expand` and `lr-collapse` fire before a direct item changes, are cancelable,
and carry `detail: { item }`. An accepted transition finishes with the non-cancelable
`lr-after-expand` or `lr-after-collapse`, carrying the same item. In `single` mode, activating the
already-expanded item is a no-op and emits no collapse lifecycle. Nested accordions own their own
triggers; an outer group does not close siblings or emit its own lifecycle for an inner item. Direct
legacy `lr-details` children are translated into the same group events. Item methods and group
methods use this lifecycle too. When opening an item in a single mode, the previously expanded
sibling's cancelable collapse is consulted before the new panel changes state; vetoing it keeps the
old item open and cancels the new expansion, so the group never silently violates its one-item
invariant.

The Details events `lr-show` and `lr-hide` have no detail payload and are cancelable; preventing
either leaves the panel in its previous state. Accepted changes emit `lr-toggle` with
`detail: { open }`, then the non-cancelable `lr-after-show` or `lr-after-hide` once rendering and
motion settle. The full orders are `lr-show` → `lr-toggle` → `lr-after-show` and `lr-hide` →
`lr-toggle` → `lr-after-hide`. Initially open markup emits nothing, and an interrupted transition
drops its stale after-event. The `animating` CSS custom state is present only between an accepted
state change and that settled boundary, and is cleared when the element disconnects.

**Keyboard:** each direct enabled accordion item contributes one heading button. Exactly one is in
the tab order; ArrowDown/ArrowUp move cyclically, horizontal arrows provide the same next/previous
movement and swap under RTL, and Home/End jump to the first/last enabled item. Disabled items are
skipped. Enter and Space use the native button activation contract. Focus and key handling stay
inside the nearest nested accordion.

**Slots:** accordion has a default slot for direct items. Accordion item has default panel content,
`label`, `icon`, and the compatibility `summary` slot; `label` slot → `summary` slot → `label`
property → `summary` property → localized `"Details"` is the precedence order. Details has
`summary`, `expand-icon`, `collapse-icon`, plus default content.

**CSS parts:** accordion exposes `base`. Accordion item exposes `base` and `accordion-item` on the
same outer wrapper; `button` and the Details-compatible `summary` name are on the same trigger; and
it also exposes `heading`, `label`, `icon`, `panel`, and `content`. Details exposes `base` and
`details` on the same native `<details>` wrapper, plus `header`, `summary`, `icon`, and `content`.
The Details icon wrapper also carries Shoelace's `summary-icon` alias, so either part name styles
the same node.

**Themeable custom properties:** accordion item exposes `--lr-accordion-item-spacing` (default
`var(--lr-form-control-padding-inline)`), `--lr-accordion-item-show-duration` and
`--lr-accordion-item-hide-duration` (both default `var(--lr-duration-base)`), and
`--lr-accordion-item-easing` (default `var(--lr-easing-standard)`). The mapped unprefixed names
`--spacing`, `--show-duration`, `--hide-duration`, and `--easing` remain accepted aliases and win
when set. The Details compatibility hooks `--lr-details-font-size` and `--lr-details-spacing` also
continue to affect an accordion item. Panel and icon transitions stop under
`prefers-reduced-motion: reduce`.

Details exposes `--lr-details-font-size` (default
`var(--lr-form-control-font-size)`) — the text size of both the summary and the panel.
`--lr-details-spacing` (default `var(--lr-form-control-padding-inline)`) — the block rhythm: the
summary's block padding and the panel's trailing padding, kept equal so a stack of disclosures reads
evenly. Each `size` tier sets both from the shared ladder, and both are declared on `:host`, so an
override has to target the element itself — an ancestor rule is shadowed. Note that the spacing knob
deliberately reads the ladder's *inline*-padding value: a stacked panel wants generous block rhythm,
whereas the ladder's own block padding exists to fit text inside a fixed control height and would
collapse the summary row. `--spacing` aliases the Details rhythm, while `--show-duration` and
`--hide-duration` (both default `var(--lr-duration-base)`) tune its icon transitions. Motion stops
under `prefers-reduced-motion`, so the `lr-after-*` events still settle promptly in that branch.

```html
<lr-details summary="Advanced options">Panel content</lr-details>
<script type="module">
  const panel = document.querySelector('lr-details');
  let ready = false;
  // Cancelable: veto the open until some precondition is met.
  panel.addEventListener('lr-show', (e) => {
    if (!ready) e.preventDefault();
  });
  panel.addEventListener('lr-after-show', () => panel.querySelector('input')?.focus());
  ready = true;
  await panel.show();
</script>
```

```html
<lr-accordion mode="single-collapsible" icon-placement="start" heading-level="2">
  <lr-accordion-item label="Account" expanded>Profile settings</lr-accordion-item>
  <lr-accordion-item>
    <strong slot="label">Notifications</strong>
    Notification settings
  </lr-accordion-item>
</lr-accordion>
<script type="module">
  const accordion = document.querySelector('lr-accordion');
  accordion.addEventListener('lr-expand', (event) => {
    if (event.detail.item.disabled) event.preventDefault();
  });
</script>
```

## `lr-breadcrumb` and `lr-breadcrumb-item`

Responsive navigation trail primitives.

**`lr-breadcrumb` properties:** `label: string = ''` names the trail, falling back to the localized
`"Breadcrumb"`; `accessibleLabel: string = ''` maps the host `aria-label`, which has highest
priority because the shadow-root `<nav>` landmark never inherits a host attribute on its own.

**`lr-breadcrumb-item` properties:** `href: string = ''` (URL-sanitized; an unsafe scheme renders the
non-link form; assigning `undefined` clears it and reads back as the canonical `''`),
`target?: string`, and `current: boolean = false` (reflected — renders a
`<span aria-current="page">` instead of an `<a>`, even when `href` is set). A target derives
`rel="noopener noreferrer"`; there is intentionally no independently settable `rel`. Each item
sets `role="listitem"` on itself. A non-current item without `href` renders a native button.

**Slots:** breadcrumb's default slot takes `lr-breadcrumb-item` children and its `separator` slot is
copied to every item without an item-level override. An item's default slot is its label;
`start`/`prefix` and `end`/`suffix` are the two upstream adornment vocabularies, and `separator`
overrides the `/` fallback.

**CSS parts:** breadcrumb `base` and `breadcrumb` are aliases on the same `<nav>`; `list` is the
`role="list"` flex row wrapping the slotted items; item `base` (the `<a>` or `<span>`), `label`,
`separator`, and the alias pairs `start`/`prefix` and `end`/`suffix`.

**Themeable custom properties:** `--lr-breadcrumb-current-color` (default
`var(--lr-color-text-quiet)`) — text color of the current-page item (`current`/`aria-current="page"`).
It is an inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be
set on the item, on `<lr-breadcrumb>`, or on any ancestor above the trail:
`::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an attribute selector after
`::part()`), so tinting the current item previously meant overriding the library-wide
`--lr-color-text-quiet` token and repainting everything else that read it. Unset, it falls back to
that token.

**Additional API surface:**

- `part="separator"` — Decorative separator shown before non-first items.

## `lr-dashboard-grid`

Responsive, keyboard-accessible controlled widget grid. It positions layout entries and emits
move, resize, collision, and layout-change requests; the host owns persistence and applies updates.

**Properties:** `layout: DashboardCell[] = []` (attribute: false, never mutated by the component),
`columns: number = 12`, `rowHeight: number = 80` (px, also the row snap pitch), `gap: number = 8`
(px, both axes), `collision: 'reject' | 'push' | 'overlap' = 'reject'`, `cellsDraggable: boolean = false`
(attribute `cells-draggable` — pointer drag plus Ctrl/Cmd+Arrow), `cellsResizable: boolean = false`
(attribute `cells-resizable` — the resize handle plus Ctrl/Cmd+Shift+Arrow), `locked: boolean =
false` (reflected — disables every gesture grid-wide), `accessibleLabel: string | null = null`
(attribute `aria-label`, falls back to a localized grid name).

**Events:** `lr-cell-move` (`detail: { id, position, previous }`), `lr-cell-resize`
(`detail: { id, size, previous }`), `lr-collision` (`detail: { id, collidedWith, policy, accepted }`),
`lr-layout-change` (`detail: { layout }`, the full proposed layout after an accepted change).
**Slots:** `cell-{id}`. **CSS parts:** `base`, `cell`, `empty`, `resize-handle`, `live-region`.

**Themeable custom properties:** `--lr-dashboard-grid-columns`, `--lr-dashboard-grid-row-height`,
and `--lr-dashboard-grid-gap` back the CSS Grid's `grid-template-columns`/`grid-auto-rows`/`gap`.
The `columns`/`rowHeight`/`gap` properties write them inline on `[part='base']` on every render, so
overriding them from a stylesheet has no effect — set the properties instead. `--lr-dashboard-grid-cell-hover-outline-color`
(default `var(--lr-color-border-strong)`) retints the mouse-hover outline on `[part='cell']` — a
preview of its own `:focus-visible` ring, shown because every cell is a real focusable,
draggable/resizable target; set it to `transparent` to opt out of the hover treatment entirely.

**Additional API surface:**

- `--lr-dashboard-grid-collision-outline-color` — Outline color of a cell whose current drag/resize preview collides with another cell. Default: `var(--lr-color-danger)`.
- `--lr-dashboard-grid-interaction-shadow` — Box shadow applied during a cell drag or resize. Default: `var(--lr-shadow)`.

## `lr-drilldown-panel`

Controlled navigation shell from a chart or table datum to related evidence, documents, entities,
or agent runs. It renders a breadcrumb path and delegates category content to existing primitives.

**Properties:** `path: DrilldownNode[] = []` and `types: NodeTypeStyle[] = []` (both attribute:
false), `accessibleLabel: string | null = null` (attribute `aria-label` — names the nested
`lr-tab-group`; unset renders no `aria-label` at all, matching `lr-tab-group`' own default),
`communityLabel: string = ''` (attribute `community-label`), `showFocusButton: boolean = true`
(attribute `show-focus-button`). **Events:**
`lr-drilldown-navigate` (`detail: { id, index }`). **Slots:** `runs`. **CSS parts:** `base`,
`breadcrumb`, `breadcrumb-item`, `breadcrumb-button`, `tabs`, `category`, `content`, `evidence-item`,
`document-item`, `entity-item`, `empty`.

## `lr-filter-bar`

Dashboard filter row that composes Lyra inputs and removable chips, with reset and loading states.

**Properties:**

- `filters: FilterBarFilterDefinition[] = []` (attribute: false) — filter schema in render order.
- `value: FilterBarValue = {}` (attribute: false) — current values keyed by filter id; reads and
  writes are shallow-copied.
- `label: string = ''` — accessible name for the internal `role="group"`.
- `disabled: boolean = false` (reflected) — disables every filter control and reset action.
- `loading: boolean = false` (reflected) — shows the status spinner and disables reset while leaving
  filters editable.
- `hasActiveFilters: boolean` (read-only) — whether any configured filter currently has a value.
- `invalidFilterIds: string[]` (read-only) — ids of required filters whose values are unset.

**Methods:** `checkValidity(): boolean` returns whether every required filter is set without
revealing errors; `reportValidity(): boolean` returns the same state and reveals every current
required-field error; `reset(): void` restores each definition's `defaultValue` (or unsets it),
unless the bar is disabled.

**Events:** `lr-input`, `lr-reset`, `lr-validity-change`. **CSS parts:** `base`, `controls`,
`filter-control`, `active-filters`, `chips`, `chip`, `reset-button`, `status`.

Each filter definition's `type` selects which existing Lyra input renders it — this component
composes them and never invents a control of its own. `'select'`/`'combobox'` map to their
same-named counterparts (with `combobox`'s `multiple` opting into a multi-value filter),
`'date'`/`'date-range'` both map to `<lr-date-input>` (single vs. `mode="range"`), and `'text'` maps
to `<lr-input>` for an open-ended free-text query rather than a closed choice set. A `'text'`
filter's value is the raw query string, verbatim, and its chip shows exactly that string — the same
text the user typed, not a truncated or normalized form.

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
touched for required validation.

The adapter's optional `emptyValue` is used when the active chip is removed, and its optional
`formatValue` controls the chip's display text. Custom values may be strings, string arrays,
booleans, or `undefined`, so controls such as `lr-time-range`, `lr-checkbox`, and an async-backed
`lr-combobox` can participate in the same controlled `value`, active-chip, reset, disabled, and
validation contract:

```ts
const filters: FilterBarFilterDefinition[] = [
  {
    id: 'archived',
    label: 'Include archived',
    type: 'custom',
    custom: {
      adapter: {
        valueFromEvent: (event) =>
          (event as CustomEvent<{ checked: boolean }>).detail.checked,
        emptyValue: false,
        formatValue: (value) => value === true ? 'Enabled' : 'Disabled',
      },
      render: (context) => html`
        <lr-checkbox
          .checked=${context.value === true}
          ?disabled=${context.disabled}
          @lr-change=${context.onValueChange}
          @focusout=${context.onFocusout}
        >${context.label}</lr-checkbox>
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
- `disableNavigationToggle: boolean = false` (attribute `disable-navigation-toggle`, reflected) —
  hides the built-in mobile toggle. A custom `navigation-toggle` slot or a slotted control carrying
  `data-toggle-nav` can still own the action.
- `strings`/`locale` and host `aria-label` follow the shared localization contract. `aria-label`
  overrides the localized name of the internal navigation landmark.

**Methods:** `showNavigation(): void`, `hideNavigation(): void`, and
`toggleNavigation(): void` update `navOpen`. `visiblePixelsInViewport(element: HTMLElement | null):
number` returns the element's finite, viewport-clamped vertical intersection in CSS pixels (`0` for
`null`, invalid geometry, or no intersection).

The default mobile toggle is a native button with localized open/close names and explicit
`aria-expanded="true|false"` plus `aria-controls` pointing to this Page's unique drawer. Opening
uses Lyra's shared modal overlay stack for inerting, scroll lock, Escape/backdrop dismissal, focus
trapping, stacking, reconnect suspension, and focus return. A custom `navigation-toggle` element is
wired to the same state and receives synchronized `aria-expanded`, `aria-controls`, and a localized
label when it did not supply its own.

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
form.

`disable-sticky` is a whitespace-token attribute, not a comma-separated value. Accepted tokens are
`banner`, `header`, `subheader`, `menu`, and `aside`; each only disables that region. Sticky offsets
use the three configured height properties, so set them to the real minimum heights when those rows
carry content. Motion uses Lyra transition tokens and is removed under `prefers-reduced-motion`.
Every region has a zero-minimum inline size and anywhere wrapping; the drawer clamps inside a 320px
allocation, and long localized or consumer-provided text cannot widen the Page.

Import only the Page registration when it is the only layout component this bundle needs:

```js
import '@aceshooting/lyra-ui/components/layout/page/page.js';
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
