## `lr-split`

Resizable panels for dashboard layouts. Direct **light-DOM children are the panels**; a divider is
auto-inserted between each adjacent pair.

**Properties:**
- `sizes: number[] = []` (attribute: false — percentages per panel, auto-computed equally if
  omitted/mismatched)
- `defaultSizes: number[] = []` (attribute: false) — initialization-only fallback: a valid restored
  `storageKey` layout wins first; otherwise a valid `defaultSizes` wins over equal distribution.
  Later reassignment never overwrites live drag/persisted state — set it once, at mount.
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

## `lr-widget`

A titled panel shell with an optional collapse toggle and an optional fullscreen-expand toggle.
First-party invention (no Web Awesome equivalent). Fullscreen promotes the same host element in
place (a CSS state, not a clone/portal), so slotted content (a chart, a running simulation, scroll
position) survives the transition.

**Properties:**
- `label: string = ''`
- `sublabel: string = ''`
- `collapsible: boolean = false` (reflected — shows the collapse/expand chevron button)
- `collapsed: boolean = false` (reflected)
- `expandable: boolean = false` (reflected — shows the fullscreen toggle button)
- `fullscreen: boolean = false` (reflected)
- `fullscreenInset: string = ''` (attribute `fullscreen-inset`) — raw CSS `inset` shorthand applied to
  `[part="base"]` and `[part="backdrop"]` while fullscreen instead of the default per-side
  `max(var(--lr-space-l), <safe-area inset>)`, e.g. `"0 0 0 240px"` to leave a 240px persistent
  sidebar/toolbar visible during fullscreen
- `compact: boolean = false` (reflected) — tighter header/body padding, same convention as
  `lr-empty`'s `compact`
- `backdropInset: string = ''` (attribute `backdrop-inset`) — overrides the fullscreen backdrop's
  CSS `inset` independently from `fullscreenInset`; when empty, it follows `fullscreenInset`
- `views: WidgetView[] = []` (attribute: false) — named alternate views for the panel body, e.g. a
  chart/table toggle inside the same card chrome; `WidgetView { id: string; label: string; icon?:
  TemplateResult }`. Each entry gets a header toggle button (`[part='view-toggle']`) and a
  `<slot name="view-${id}">`. Empty (the default) renders today's single unnamed default slot as the
  sole view, unchanged.
- `activeView: string = ''` (attribute: false) — the currently active view's `id`; defaults to the
  first entry of `views` (or `''` when `views` is empty). Settable directly to control the active
  view externally; also updated internally when a view toggle is clicked.
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides the label-derived fullscreen
  dialog name.

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

**Known gotchas:**
- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if `fullscreen` was still `true`
  across the move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in
  between, so `willUpdate()` alone wouldn't otherwise notice.
- `collapsed` hides the body via `hidden` rather than an animated height transition — collapsing is
  instant, not a slide.

---

## `lr-carousel`

Accessible carousel for arbitrary slotted slide elements. It shows one assigned element at a time,
adds slide semantics and localized position labels, and provides keyboard, button, and indicator
navigation.

**Properties:**
- `index: number = 0` (attribute `index`, reflected) — active slide index
- `loop: boolean = false` (attribute `loop`, reflected) — wraps navigation at either end
- `autoplay: boolean = false` (attribute `autoplay`, reflected) and `autoplayInterval: number = 5000`
  (attribute `autoplay-interval`) — optional timed advance; autoplay is disabled under reduced motion
- `showIndicators: boolean = true` (attribute `show-indicators`) — renders slide indicator buttons
- `accessibleLabel: string = ''` (attribute `accessible-label`) — fallback landmark name; a host
  `aria-label` takes precedence

**Methods:** `next()`, `previous()`, and `goTo(index)` update the active index and emit
`lr-slide-change` (`detail: { index }`).

**CSS parts:** `base` (the `role="region"` landmark), `viewport` (the keyboard-focusable slide
viewport), `track`, `controls`, `previous-button`, `next-button`, `previous-glyph`/`next-glyph` (the
chevron inside each, mirrored under RTL), `indicators`, `indicator` (one indicator's hit target,
sized to the shared minimum tappable size), and `indicator-dot` (the compact visible dot inside it).

**Themeable custom properties:** `--lr-carousel-indicator-current-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-carousel-indicator-current-border-color` (default
`var(--lr-color-brand)`) — background and border color of the current slide's `indicator-dot`
(`[aria-current='true']`). Same state-hook mechanics as `<lr-widget>`'s view-toggle pair above:
inline `var()` fallbacks, never declared on `:host`, so either can be set on the element or on any
ancestor; unset, each falls back to the token the rule used before. This shape is what makes the
current indicator addressable at all — `::part(indicator)[aria-current='true']` is invalid CSS, so
hijacking a library-wide color token was previously the only lever.

```html
<lr-carousel aria-label="Screenshots">
  <img alt="Dashboard overview" src="overview.png">
  <img alt="Dashboard details" src="details.png">
</lr-carousel>
```

---

## `lr-carousel-item`

Optional semantic wrapper for one slide in `<lr-carousel>`. The carousel also accepts arbitrary
slotted elements, so this element is useful when a migration needs the explicit item tag.

**Slots:** default slide content.

**CSS parts:** `base`.

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

---

## `lr-scroller`

Responsive overflow surface with optional previous/next controls. The default slot remains the
consumer's content, and the viewport is a native scroll container that works in narrow panels as
well as full-width layouts.

**Properties:**
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected)
- `controls: boolean = false` (reflected) — show previous/next controls
- `hideScrollbar: boolean = false` (attribute `hide-scrollbar`, reflected)
- `scrollStep: number = 0` (attribute `scroll-step`) — custom step; zero uses 80% of the viewport
- `label: string = ''` — accessible region name; a host `aria-label` is used when set

**Events:** `lr-scroll` with `scrollStart`, `scrollEnd`, `scrollLeft`, and `scrollTop` in the
detail object.

**Slots:** default scrollable content.

**CSS parts:** `base`, `viewport`, `content`, `previous`, `next`, `control` (shared by `previous` and
`next`), and `previous-glyph`/`next-glyph` (the chevron inside each, mirrored under RTL).

**Themeable custom properties:** `--lr-scroller-control-size` (default `var(--lr-size-2rem)`) — the
previous/next control's box size; the interactive target never shrinks below `--lr-icon-button-size`
regardless. `--lr-scroller-min-block-size` (default `var(--lr-size-10rem)`) — the vertical
orientation's minimum block size, ignored while horizontal.

```html
<lr-scroller controls label="Project cards">
  <lr-card>Solar</lr-card>
  <lr-card>Wind</lr-card>
  <lr-card>Battery</lr-card>
</lr-scroller>
```

---

## `lr-tabs`

A tab strip whose panels are direct light-DOM children, each carrying `slot="<id>"` (the panel's
stable id) and `label="<text>"` (the tab button's text). One named `<slot>` is rendered per distinct
`slot` name found among the current children — a child with no `label`, or a name with no matching
child, simply never produces a tab. Implements the WAI-ARIA APG tabs pattern with automatic
activation: Left/Right (swapped under RTL) move focus *and* selection together, Home/End jump to the
first/last enabled tab, and a roving `tabindex` follows whichever tab is currently selected.

A tab button's *visible* content can carry a leading icon without ever changing its *accessible
name* (always exactly `label`'s text): give a tab an extra direct-child sibling of `<lr-tabs>`
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

**Events:** `lr-tabs-change` (`detail: { tabId: string }`) — fired when the active tab changes via
click or keyboard. Not fired when `active` self-corrects to a valid tab (initial default, or a tab
disappearing/becoming disabled underneath the current selection).

**Slots:** default — direct children with `slot="<id>" label="<text>"` (and optionally `disabled`);
one becomes each tab's panel. `<id>-icon` — optional sibling direct child supplying a tab's leading
icon content; excluded from the tab button's accessible name.

**CSS parts:** `base` (root wrapper around the tablist and panels), `tablist` (the `role="tablist"`
row of tab buttons), `tab` (a single tab button), `tab-icon` (the optional leading-icon wrapper
inside a tab button; only rendered when that tab has a matching `<id>-icon` sibling), `panel` (a
single `role="tabpanel"` wrapper, one per tab, hidden unless active)

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the static
mask fade at each horizontal scroll edge of the tablist. `--lr-tabs-selected-color` (default
`var(--lr-color-brand)`) — text color of the selected tab, scoped to `[aria-selected='true']` only,
so it never repaints a hovered unselected tab. `--lr-tabs-indicator-color` (default
`var(--lr-color-brand)`) — the selected tab's underline, themeable independently of its text color.
`--lr-tabs-hover-color` (default `var(--lr-color-text)`) — text color of a hovered, non-disabled
tab, independent of the two selected-state hooks. All three are declared as inline `var()` fallbacks
at the point of use rather than on `:host`, so each can be set on the element *or on any ancestor* —
the pattern exists because `::part(tab)[aria-selected='true']` is invalid CSS (Shadow Parts forbids
an attribute selector after `::part()`), which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-text` tokens as the only way to restyle a selected or hovered tab,
repainting everything else that reads them. Unset, each falls back to the token its rule used
before, so rendering is unchanged. Otherwise shared tokens —
`--lr-space-xs/-s/-m`, `--lr-color-border/-text-quiet/-text/-brand`, `--lr-transition-fast`,
`--lr-radius`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-tabs active="general">
  <div slot="general" label="General">General settings…</div>
  <div slot="advanced" label="Advanced" disabled>Advanced settings…</div>
</lr-tabs>
<script type="module">
  document.querySelector('lr-tabs').addEventListener('lr-tabs-change', (e) => console.log(e.detail.tabId));
</script>
```

**Known gotchas:**
- Tabs are rebuilt from direct children via a `MutationObserver` watching `childList` plus
  `attributeFilter: ['slot', 'label', 'disabled']` — not `slotchange` — because a brand-new tab's
  `slot` name has no matching `<slot>` to fire `slotchange` on until this component has already
  rendered one for it, and neither `slotchange` nor any Lit lifecycle hook observes a plain
  attribute edit on a light-DOM child at all.
- If two children share the same `slot` name, the *first* one wins for the tab button's label
  (matches native slot assignment: both would render into the one panel, but only one label can back
  the button).
- Left/Right are swapped under RTL (read via `internal/rtl.ts`'s `isRtl()`); Up/Down are not used —
  this is a horizontal strip only.

---

## `lr-stepper`

Ordered multi-step wizard/form navigation: an index/label per step, `current`/`completed`/`disabled`/
`error` state, and click-to-jump. First-party invention (no Web Awesome equivalent). Fully
data-driven and controlled, like `lr-table`'s `columns`/`rows` — it never mutates `steps` itself; a
click, or Enter/Space on a non-disabled step, fires a cancelable `lr-step-select`, and the host
decides whether/how `steps` changes in response (mirroring `lr-dialog-close`'s cancelable-event
convention).

**Properties:**
- `steps: StepItem[] = []` (attribute: false) — `StepItem { id: string; label: string; state:
  'pending' | 'current' | 'completed' | 'disabled' | 'error'; title?: string }`; `title` is an
  optional native tooltip for the step's button (e.g. explaining why a `disabled` step is locked) —
  omit it for no `title` attribute at all, not an empty string. Never mutated by this component.
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
- `effectiveOrientation: 'horizontal' | 'vertical'` (readonly getter) — the live layout/navigation
  axis actually in effect; identical to `orientation` whenever `orientationBreakpoint` is unset or
  doesn't resolve to a length. Also reflected as `data-effective-orientation` (only present while
  `orientationBreakpoint` resolves to a usable length).
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name applied to the
  `role="tablist"` step strip; attribute-reflects from a host-level `aria-label`. Unset, the
  tablist renders without an `aria-label` (there is no localized default name).

**Events:** `lr-step-select` (`detail: { index, id }`) — fired on click, or Enter/Space while
focused, on a non-`disabled` step. Cancelable, though this component takes no default action of its
own to prevent (it never mutates `steps`) — `preventDefault()` is available for a host that wants a
single place to short-circuit its own listener's follow-up work. `lr-stepper-orientation-change`
(`detail: { orientation }`) — fired only when an enabled `orientationBreakpoint` actually changes
`effectiveOrientation`.

**Slots:** none.

**CSS parts:** `base` (root wrapper, `role="tablist"`), `step` (a single step button, `role="tab"`),
`step-index` (the numbered index chip, shown for `pending`/`current`/`error` steps), `step-check`
(the completed-checkmark glyph, shown for `completed` steps instead of `step-index`), `step-label`
(the step's label text).

**Themeable custom properties:** `--lr-stepper-current-color` (default `var(--lr-color-text)`) —
text color of the `current` step. `--lr-stepper-error-color` (default `var(--lr-color-danger)`) —
text color of an `error` step. `--lr-stepper-current-index-bg` (default `var(--lr-color-brand)`) and
`--lr-stepper-current-index-color` (default `var(--lr-color-surface)`) — background and text color
of the `current` step's numbered `step-index` chip. Each is an inline `var()` fallback at the point
of use, never declared on `:host`, so it can be set on the element or on any ancestor; and each is
scoped to its own `data-state`, so recoloring the current step leaves `pending`/`completed`/`error`
steps alone. The hooks exist because `::part(step)[data-state='current']` is invalid CSS — Shadow
Parts forbids an attribute selector after `::part()` — so state-specific theming previously meant
overriding a library-wide `--lr-color-*` token and repainting everything else that read it. Unset,
each falls back to the token its rule used before. Otherwise shared tokens —
`--lr-space-m`/`-xs`/`-2xs`,
`--lr-color-text-quiet`/`-text`/`-danger`/`-brand`/`-surface`, `--lr-radius`/`-pill`,
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
- `role="tablist"`/`role="tab"` back the keyboard/focus contract (roving tabindex, arrow-key
  navigation) even though this isn't a `<lr-tabs>`-style panel switcher — there's no associated
  `role="tabpanel"`, since this component renders no panel content of its own.
- Left/Right (horizontal) and Up/Down (vertical) are mutually exclusive per `orientation` — there's
  no single set of keys that works in both.

---

## `lr-control-group`

Responsive semantic grouping for mixed controls and actions. It keeps slotted children in a
wrapping inline-flex row, centers children with different intrinsic heights, and switches to a
full-width allocation in narrow containers. Use it for dashboard toolbars that combine segmented
controls, selects, buttons, and other interactive elements.

**Properties:**
- `label: string = ''` — accessible name for the internal `role="group"`; when empty, a host
  `aria-label` is forwarded as a fallback.

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

---

## `lr-segmented`

A single-select button row with the WAI-ARIA APG `radiogroup` contract built in:
`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move
both select immediately, like a native radio group), cyclic Arrow/Home/End navigation among
non-disabled items. First-party invention (no Web Awesome equivalent) — "choose exactly one of N
labeled options, rendered as a button row" is ubiquitous settings/filter-panel UI.

**Properties:**
- `items: SegmentedItem[] = []` (attribute: false) — `SegmentedItem { value: string; label: string;
  icon?: unknown; disabled?: boolean }`; `icon` renders as a decorative leading visual inside
  `segment-icon` and does not replace the required text label.
- `value: string = ''` — the currently selected item's `value`.
- `label: string = ''` — accessible name copied to the internal `role="radiogroup"`; when empty, a
  host-level `aria-label` is used as a fallback.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — visual size, matching
  `lr-select`/`lr-combobox`'s `xs`-`xl` scale plus `lr-input`'s `2xs` tier. `m` (the default) is
  unchanged from this component's pre-`size` rendering.

**Events:** `lr-change` (`detail: { value }`) — fired when the selected value changes via click or
keyboard.

**Slots:** none.

**CSS parts:** `base` (the `role="radiogroup"` root), `segment` (a single `role="radio"` button),
`segment-icon` (an optional decorative leading icon), `segment-label` (the segment's label text).

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the static mask
fade at each horizontal scroll edge of the track. `--lr-segmented-track-min-height`,
`--lr-segmented-segment-padding`, and `--lr-segmented-font-size` are the three knobs `size` swaps
(`m` defaults: `auto`, `var(--lr-size-0-125rem) var(--lr-space-s)`, `var(--lr-font-size-sm)`) —
override them on the host for a size tier the scale doesn't cover, since a `:host([size])` rule
wins over the `:host` default.

`--lr-segmented-track-height` pins the `base` track's exact height at every `size` tier (it sets
both `block-size` and `min-block-size`), for a row that has to sit flush beside a hard-sized toolbar
control. It is **genuinely undeclared by default** — not `auto` — and that is load-bearing: an
exact-height hatch only works as an undeclared sentinel, because `auto` is itself a valid value that
would always win and would silently turn every tier's `--lr-segmented-track-min-height` floor into
dead code. While it is unset, each tier keeps its own floor and the track grows with its content.

`--lr-segmented-selected-bg` (default `var(--lr-color-surface)`), `--lr-segmented-selected-color`
(default `var(--lr-color-text)`), `--lr-segmented-selected-font-weight` (default
`var(--lr-font-weight-semibold)`) and `--lr-segmented-selected-shadow` (default `var(--lr-shadow)`)
style the checked segment's pill; `--lr-segmented-hover-color` (default `var(--lr-color-text)`)
styles a hovered segment that is neither checked nor disabled, independently of the four above — so
recoloring the checked pill never bleeds onto hover. All five are inline `var()` fallbacks at the
point of use rather than `:host` declarations, so each can be set on the element *or on any
ancestor*; unset, each falls back to the token its rule used before. They exist because
`::part(segment)[aria-checked='true']` is invalid CSS — Shadow Parts forbids an attribute selector
after `::part()` — which previously left hijacking the library-wide
`--lr-color-surface`/`--lr-color-text` tokens as the only way to restyle a selected segment,
repainting every other element that read them.

Otherwise shared tokens — `--lr-color-border`/`-surface`/`-text`/
`-text-quiet`, `--lr-radius`, `--lr-font-weight-semibold`, `--lr-space-s`, `--lr-shadow`,
`--lr-opacity-disabled`, `--lr-focus-ring-*`.

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

---

## `lr-virtual-list`

A generic windowed/virtualized list host. Renders only the items within the current viewport (plus
`overscan` padding rows on each side) as real DOM, regardless of how large `items` is, so a
multi-thousand-row chat-history sidebar (or a long message thread) stays cheap to scroll. Content is
entirely caller-supplied: `renderItem(item, index)` returns whatever `lit-html` value should represent
that row, and `keyFunction(item, index)` gives it a stable identity for DOM reconciliation. First-party
invention (no Web Awesome equivalent).

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
- `activeId: string = ''` (attribute `active-id`) — when set and it matches a row's `keyFunction`
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
so it isn't clipped by the container's own `overflow: auto`).

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
- **A row that renders a popup needs the focused-row lift, and this is why `[part='row']` has one.**
  Each row carries `will-change: transform` (a compositor hint for the per-frame translate), which
  makes every row its own stacking context. Rows otherwise carry no `z-index`, so they paint in DOM
  order and each one paints over the previous. Anything a row renders that overflows its own box —
  an `<lr-menu>` popup in a row-action menu, a tooltip, an outward focus ring — is therefore painted
  *underneath* every following row, no matter how high its own `z-index` is: that `z-index` only
  orders siblings inside the row's own context. The last row always looks correct, which is exactly
  why a short fixture never catches it. `[part='row']:focus-within` lifts the row to
  `--lr-layer-content` for precisely as long as something inside it holds focus — the lifetime of an
  open popup — and costs nothing otherwise. The value deliberately *matches* `[part='group']`'s
  rather than exceeding it, so the two land on the same layer and DOM order decides: groups render
  before the rows, so a focused row wins while (and only while) it holds focus, which is right — a
  group header is a non-interactive `pointer-events: none` label.

---

## `lr-app-rail`

A responsive navigation rail that adapts across three presentations as the *viewport* narrows (not
this element's own inline size): `'full'` (nav items show icon + label, inline), `'icon-only'` (a
narrower inline rail, icons only), and `'mobile'` (hidden behind a toggle button; opening it shows a
focus-trapped floating overlay over the page). First-party invention (no Web Awesome equivalent).
Breakpoints are viewport-width `matchMedia()` queries against `icon-only-breakpoint`/
`mobile-breakpoint`, not a `ResizeObserver` on this element — presentation tracks the actual device/
window width the way a native OS shell's navigation does, not however much horizontal space a
particular layout happens to give it. `[part="base"]` (the inline `'full'`/`'icon-only'`
presentation) and `[part="panel"]` (the mobile overlay) are the *same* element promoted in place
across modes (mirrors `<lr-widget>`'s fullscreen mode) — never both at once, and slotted nav
content is never duplicated.

Opting in to `resizable` adds a continuously draggable width for the `'full'` state: a
`[part="resizer"]` handle (pointer-drag and Left/Right-arrow keyboard stepping, RTL-aware) clamped to
`[minRailWidthPx, maxRailWidthPx]`, with no built-in persistence — a consumer that wants the chosen
width to survive a reload listens for `lr-rail-resize` and persists `railWidthPx` itself.
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
(`detail: AppRailToggleDetail` = `{ open: boolean }`; the mobile overlay opened or closed — via the
built-in toggle button, Escape, a backdrop click, a nav-item click while open, or a breakpoint/forced
mode change leaving `'mobile'` while open — not fired when a consumer sets `open` directly),
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
invention (no Web Awesome equivalent). Typical uses: a settings panel or a conversation-history
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

## `lr-menu` / `lr-menu-item`

An anchored dropdown built around a consumer-supplied trigger element (typically an icon button)
assigned to the `trigger` slot. First-party invention (no Web Awesome equivalent) — a close, drop-
in-shaped replacement for reaching outside this library for a third-party dropdown to build a gear
menu, an avatar menu, or a history row's overflow menu. Uses the WAI-ARIA "menu button" pattern —
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

**Methods:** `show(focus: 'first' | 'last' = 'first')` opens the menu and moves roving focus to the
first (or, with `'last'`, the last) non-disabled item; a no-op when already open.
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
`<lr-menu-item>`'s own `lr-menu-item-select`; always followed by the menu closing and focus
returning to the trigger)

**Slots:** `trigger` (the consumer's own trigger element — first assigned element wins if several
are assigned; enhanced imperatively with `aria-haspopup="menu"`/`aria-expanded`/`aria-controls`
since those attributes belong on the actual interactive trigger, which lives outside this
component's shadow root), default (`<lr-menu-item>` elements, plus optionally plain `<hr>`
dividers between groups — native `<hr>` already carries an implicit `separator` role),
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

### `lr-menu-item`

Not meaningful standalone — it exists purely as `<lr-menu>`'s light-DOM child, the same
relationship `<lr-option>` has to `<lr-combobox>`/`<lr-select>`. `role="menuitem"` and the
roving `tabindex` both live on the host element itself (mirroring `<lr-tree-node>`), not an
internal shadow-DOM button; `<lr-menu>` is the sole owner of this element's `tabIndex`.

**Properties:**
- `value: string = ''` — an id/value echoed back in the parent `<lr-menu>`'s `lr-menu-select`
  detail
- `disabled: boolean = false` (reflected — disables selection and excludes this item from
  `<lr-menu>`'s roving-tabindex navigation entirely)
- `destructive: boolean = false` (reflected — tints the row with `--lr-color-danger`, for a
  dangerous action like "Delete")
- `type: 'normal' | 'checkbox' = 'normal'` — `'checkbox'` (mirroring `wa-dropdown-item`'s identical
  `type` option) renders `role="menuitemcheckbox"` in place of `role="menuitem"`, with `aria-checked`
  reflecting `checked` and a checkmark glyph shown once `checked` is `true`. `'normal'` (the default)
  renders and behaves exactly as before this option existed.
- `checked: boolean = false` (reflected) — whether a `type="checkbox"` item is checked; meaningless
  (ignored) for `type="normal"`

**Methods:** `select(): void` — fires `lr-menu-item-select` (no-op while `disabled`). Called
internally by this element's own click handler and by `<lr-menu>`'s Enter/Space keydown handling
of the roving-focused item; also the cleanest way for a consumer/test to trigger selection
programmatically instead of clicking the shadow-DOM `[part="base"]` element (see the gotcha below).
For `type="checkbox"`, also toggles `checked` and fires `lr-menu-item-change` first.

**Events:** `lr-menu-item-select` (no detail payload — `this.emit('lr-menu-item-select')` is
called with no second argument, so `event.detail` is `null`, not `undefined`; fires on click, or
when the parent `<lr-menu>`'s own Enter/Space keydown handling calls `select()` on the currently
roving-focused item), `lr-menu-item-change` (`detail: { value, checked }` — fired when a
`type="checkbox"` item is activated and its `checked` state toggled, in addition to — never instead
of — `lr-menu-item-select`; never fired for `type="normal"`)

**Slots:** default (the item's label content), `icon` (optional leading icon)

**CSS parts:** `base` (the row — `role` lives on the host, not this part), `icon` (wrapper around
the `icon` slot; not rendered/hidden entirely while the slot is empty), `label` (wrapper around the
default slot), `checkmark` (the checkmark glyph shown when a `type="checkbox"` item is `checked`;
not rendered at all for `type="normal"`)

**Themeable custom properties:** shared tokens only (`--lr-radius`, `--lr-focus-ring-width`,
`--lr-focus-ring-color`, `--lr-space-xs`, `--lr-space-s`, `--lr-color-brand-quiet`,
`--lr-opacity-disabled`, `--lr-color-danger`, `--lr-color-danger-quiet`).

**Optional peer deps:** none.

### `lr-dropdown-item`

Compatibility naming alias for `<lr-menu-item>`. It is a subclass of the same implementation,
so `value`, `disabled`, `destructive`, `type`, `checked`, `select()`, checkbox events, and menu
roving focus behave identically.

**Slots:** default label content and optional `icon`.

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
  <lr-menu-item value="delete" destructive>Delete</lr-menu-item>
</lr-menu>
<script type="module">
  document.querySelector('lr-menu').addEventListener('lr-menu-select', (e) => console.log(e.detail.value));
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

**Known gotchas:**
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

---

## `lr-dock-panel`

A single panel docked to one edge of whatever contains it, resizable by dragging its inner edge.
First-party invention (no Web Awesome equivalent). Unlike `lr-split` (which owns and lays out N
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
- `size: string = '280px'` — the current docked size along the resize axis, as a CSS length.
- `minSize: string = '160px'` (attribute `min-size`) — minimum resize bound, as a CSS length.
- `maxSize: string = ''` (attribute `max-size`) — maximum resize bound. Empty means "no explicit
  cap": the live extent of the containing element is used instead (falling back to the viewport if
  there's no parent, e.g. not yet connected), so the panel still can't be dragged wider/taller than
  its container.
- `collapsible: boolean = false` (reflected)
- `collapsed: boolean = false` (reflected)
- `resizable: boolean = true` (reflected) — when `false`, no drag handle renders at all and the panel
  is a fixed size. (Assign `false` via a **property** binding, e.g. `.resizable=${false}` — a
  `?resizable=${false}` boolean-attribute binding cannot override a `true` default; see AGENTS.md.)

**Exported helper:** `parseLengthPx(length: string, containerPx: number, fontSizeEl: Element =
document.documentElement): number | undefined` — resolves an arbitrary CSS length (`px`, `rem`, `em`,
`vw`, `vh`, `%`, or a bare/unitless number treated as `px`) to a live pixel value without a DOM-probe
measurement, since `min-size`/`max-size` are pure constraints that are never themselves rendered
anywhere. `rem` resolves against the document root's font size; `em` resolves against `fontSizeEl`'s
own computed font size; `%` resolves against `containerPx`. Returns `undefined` for an
empty/unparseable string. Used internally to resolve `min-size`/`max-size`; the panel's *current* size
is instead always read back live from `getBoundingClientRect()`, which handles any unit for free.

**Events:**
- `lr-resize` — `detail: { size }` (a `px` CSS length string), fired on every drag step, drag
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
    size="320px"
    min-size="200px"
    max-size="480px"
    collapsible
    @lr-resize=${(e) => console.log(e.detail.size)}
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
for the block axis, 16px per step) — always commits `size` as a rounded `px` string regardless of
what unit `size`/`min-size`/`max-size` were originally expressed in.

**Known gotchas:**
- `collapsed` doesn't zero the panel's box — it shrinks to the persistent rail size
  (`--lr-dock-panel-collapsed-size`). `size` itself is left untouched while collapsed, so
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
- `interactive: boolean = false` (reflected) — opt-in clickable-tile behavior: the hover/focus-visible
  treatment (border-color shift, `cursor: pointer`) plus, when `href` is **not** also set, real
  activation semantics — `[part='base']` becomes focusable (`tabindex="0"`), responds to
  Enter/Space, and emits `lr-card-activate`. With `href` set, the root is already a real `<a>`, so
  native navigation *is* the activation and `lr-card-activate` never fires. `false` (the default)
  reproduces a plain static card: no `tabindex`, no listeners, no events.
- `href?: string` — when set, the card's root renders as a real `<a href=...>` instead of a `<div>`,
  for a whole-card link (e.g. a wide CTA tile). Unset (the default) renders a plain `<div>`.

**Events:** `lr-card-activate` (no detail) — the whole card was activated, by click or by
Enter/Space while `[part='base']` has focus. Only fired while `interactive` is set **without**
`href`. Never fired for an interaction that originated in a slotted control, so a card can keep its
own action buttons (see the gotchas below).

**Slots:** default (the card body), `header` (header row content, rendered above the body), `media`
(media content, e.g. an image, rendered above the header), `footer` (footer content, rendered below
the body), `actions` (small header controls, rendered alongside the header content).

**CSS parts:** `base` (the outer container — a `<div>`, or an `<a>` when `href` is set), `media`
(wrapper around the `media` slot, hidden entirely when empty), `header` (wrapper around the `header`
slot and `actions`, hidden entirely when both are empty), `actions` (wrapper around the `actions`
slot, hidden entirely when empty), `body` (wrapper around the default slot), `footer` (wrapper around
the `footer` slot, hidden entirely when empty).

**Themeable custom properties:** shared tokens only — `--lr-color-border`/`-surface`/`-brand`/
`-brand-quiet`, `--lr-radius`, `--lr-space-s`/`-m`, `--lr-transition-fast`,
`--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-card appearance="outlined" interactive href="/reports/42">
  <img slot="media" src="/thumb.png" alt="" />
  <span slot="header">Q3 Report</span>
  <span slot="actions"><lr-chip tone="success">Ready</lr-chip></span>
  Revenue up 12% quarter-over-quarter.
  <span slot="footer">Updated 2 days ago</span>
</lr-card>
```

**Known gotchas:**
- every `appearance` renders on the *same* `[part="base"]` element — there's no separate element per
  variant, so a `::part(base)` override applies uniformly regardless of `appearance`.
- slot-presence (`header`/`media`/`footer`/`actions`) is tracked in JS, not via CSS `:empty` (a
  `[part]` wrapper always contains a literal `<slot>` child, so `:empty` never matches) — the same
  pattern `lr-empty`/`lr-widget` use.
- **an `interactive` card without `href` deliberately carries no `role="button"`.** A card is a
  *container* — it routinely holds slotted buttons and links — and `role="button"` around focusable
  descendants is the `nested-interactive` accessibility violation this library's own a11y gate
  enforces. (`lr-chip`'s `toggleable` mode *can* carry `role="button"` because it forbids focusable
  children outright.) The consequence is that the card is announced as a plain focusable region, so
  give it your own `aria-label` when the content doesn't already name it.
- because there is no `role="button"` to disambiguate, "did the user aim at the card or at a control
  inside it?" is answered at event time: the composed path from the original target up to
  `[part='base']` is walked, and `lr-card-activate` is suppressed if anything along the way is
  itself a control (a link, `button`, `input`, `select`, `textarea`, `label`, `summary`,
  `contenteditable`, anything carrying a `tabindex` other than `-1`, or an ARIA widget role such as
  `button`/`link`/`checkbox`/`switch`/`radio`/`menuitem`/`option`/`tab`/`textbox`/`slider`/
  `spinbutton`). Using the *composed*
  path is what makes this work through a slotted component's own shadow root — a click on
  `<lr-button>` retargets to the host, but its composed path still contains the internal native
  `<button>`.

---

## `lr-command-palette`

Searchable application command menu. Renders nothing at all while closed. Uses the same shared
overlay infrastructure as `lr-dialog` (focus-trapping Tab, Escape dismissal, backdrop-click
dismissal, ref-counted document scroll lock).

**Properties:**
- `open: boolean = false` (reflected)
- `commands: LyraCommand[] = []` (attribute: false) — `{ id, label, description?, group?, shortcut?,
  keywords?, disabled?, onSelect? }`. Filtering is case-insensitive substring matching over
  `label` + `description` + `group` + `keywords` joined together (not fuzzy/subsequence), memoized
  per `commands` array identity — reassign the array, never mutate it in place. Consecutive commands
  sharing a `group` render one `[part='group']` heading, so pre-sort by group yourself.
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
heading), `command` (a `role="option"` button), `description`, `shortcut`, `empty`.

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

## `lr-details`, `lr-accordion`, and `lr-accordion-item`

`lr-details` is a native-semantics disclosure panel. `lr-accordion` coordinates slotted
details panels and closes siblings unless `multiple` is true. `lr-accordion-item` is an
accordion-compatible alias.

**Properties:** `open`, `disabled`, and `summary` on details/items; `multiple` on accordion.
**Events:** `lr-toggle` with `{ open }` from details/items. **Slots:** `summary` and default
content on details/items; default panels on accordion. **CSS parts:** `base`, `summary`, `content`
on details/items; `base` on accordion.

## `lr-breadcrumb` and `lr-breadcrumb-item`

Responsive navigation trail primitives.

**`lr-breadcrumb` properties:** `accessibleLabel: string = ''` (attribute `aria-label`) — overrides
the localized `"Breadcrumb"` name on the shadow-root `<nav>` landmark, which never inherits a host
attribute on its own.

**`lr-breadcrumb-item` properties:** `href: string = ''` (URL-sanitized; an unsafe scheme renders the
non-link form) and `current: boolean = false` (reflected — renders a `<span aria-current="page">`
instead of an `<a>`, even when `href` is set). Each item sets `role="listitem"` on itself.

**Slots:** breadcrumb's default slot takes `lr-breadcrumb-item` children; an item's default slot is
its label.

**CSS parts:** breadcrumb `base` (the `<nav>`) and `list` (the `role="list"` flex row wrapping the
slotted items); item `base` (the `<a>` or `<span>`).

**Themeable custom properties:** `--lr-breadcrumb-current-color` (default
`var(--lr-color-text-quiet)`) — text color of the current-page item (`current`/`aria-current="page"`).
It is an inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be
set on the item, on `<lr-breadcrumb>`, or on any ancestor above the trail:
`::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an attribute selector after
`::part()`), so tinting the current item previously meant overriding the library-wide
`--lr-color-text-quiet` token and repainting everything else that read it. Unset, it falls back to
that token.

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
overriding them from a stylesheet has no effect — set the properties instead.

## `lr-drilldown-panel`

Controlled navigation shell from a chart or table datum to related evidence, documents, entities,
or agent runs. It renders a breadcrumb path and delegates category content to existing primitives.

**Properties:** `path: DrilldownNode[] = []` and `types: NodeTypeStyle[] = []` (both attribute:
false), `accessibleLabel: string | null = null` (attribute `aria-label` — names the nested
`lr-tabs`; unset renders no `aria-label` at all, matching `lr-tabs`' own default),
`communityLabel: string = ''` (attribute `community-label`), `showFocusButton: boolean = true`
(attribute `show-focus-button`). **Events:**
`lr-drilldown-navigate` (`detail: { id, index }`). **Slots:** `runs`. **CSS parts:** `base`,
`breadcrumb`, `breadcrumb-item`, `breadcrumb-button`, `tabs`, `category`, `content`, `evidence-item`,
`document-item`, `entity-item`, `empty`.

## `lr-filter-bar`

Dashboard filter row that composes Lyra inputs and removable chips, with reset and loading states.

**Properties:** `filters`, `value`, `disabled`, `loading`, `label`, `hasActiveFilters`,
`invalidFilterIds`, `checkValidity`, `reportValidity`, `reset`. **Events:** `lr-input`, `lr-reset`,
`lr-validity-change`. **CSS parts:** `base`, `controls`, `filter-control`, `active-filters`,
`chips`, `chip`, `reset-button`, `status`.

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
