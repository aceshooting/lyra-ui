## `lr-combobox` / `lr-option`

Filterable single/multi-select combining a text input with a listbox. Mirrors the core
`<wa-combobox>` API under the `lr-` prefix. **Form-associated** (hand-rolled internals, not the
shared `FormAssociated` mixin — see gotchas).

### `lr-combobox`

**Properties:**
- `multiple: boolean = false` (reflected)
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — same scale as `lr-select`'s `size`;
  also scales the "+N" overflow tag and decorative expand icon; `size="s"` shares its outer
  control height with `lr-input`, `lr-select`, and `lr-segmented` without part overrides)
- `placeholder: string = ''`
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`; also reflected as
  `aria-required` on `<input part="combobox-input">` immediately, and `aria-invalid` once the field
  has been touched, see gotchas)
- `name: string = ''`
- `label: string = ''`
- `hint: string = ''`
- `errorText: string = ''` (attribute `error-text` — static error copy shown below the hint;
  overridden by slotted `error` content when provided)
- `open: boolean = false` (reflected)
- `clearable: boolean = false` (reflected) — displays the clear button while there is something to
  clear on **either** axis this control owns: a committed selection, or *visible* filter text. See
  "the clear button covers two axes" below
- `withClear: boolean = false` (attribute `with-clear`) — deprecated compatibility alias for
  `clearable`; either property enables the same clear button
- `autocomplete: string = 'off'`, `inputMode: string = ''` (attribute `inputmode`),
  `enterKeyHint: string = ''` (attribute `enterkeyhint`), `spellcheck: boolean = true`,
  `autocapitalize: string = ''`, and `autoCorrect: string = ''` (attribute `autocorrect`) — native
  editing-assistance attributes forwarded to the internal filter input
- `maxOptionsVisible: number = 3` (attribute `max-options-visible` — caps how many selected tags
  show before collapsing to `+N`)
- `emptyText: string = 'No results'` (attribute `empty-text`)
- `loadingText: string = 'Loading…'` (attribute `loading-text` — listbox row shown while a `source`
  fetch is in flight)
- `overflowText: string = '+{n} more — refine your search'` (attribute `overflow-text` — listbox row
  shown when `maxRender` caps the row list; `{n}` is replaced with the hidden count)
- `filter: OptionFilter | null = null` (attribute: false — `(option, query) => boolean`; default
  matches `label`/`searchText` case-insensitively; ignored while `source` is set)
- `source: ComboboxSource | null = null` (attribute: false — `(query: string) =>
  Promise<ComboboxSourceRow[]>`; when set, replaces the light-DOM `<lr-option>` list with an async
  lookup, debounced ~200ms after each keystroke and re-run on clear/pick. `loadingText` is shown
  while a call is in flight; a stale in-flight call that resolves after a newer one (or after
  disconnect) is dropped via a monotonic token)
- `maxRender: number = 200` (attribute `max-render` — caps how many rows render at once, always
  keeping the current selection visible even if it's outside the cap; the excess renders as one
  `overflowText` row instead of being dropped silently)
- `value: string | string[]` — a getter/setter: plain `string` in single mode, `string[]` in
  `multiple` mode
- `selectedRows: ComboboxSourceRow[]` (read-only getter) — structured rows for the current
  selection, including any opaque `data` payload supplied by an async source. Selected async rows
  remain available after the query changes or a later source result no longer contains them
- `selectionStart`, `selectionEnd`, and `selectionDirection` — selection getters/setters forwarded
  to the internal input

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and `setRangeText()`
forward to the internal input. `setRangeText()` synchronizes the filter query and visible options.

`ComboboxSourceRow = { value: string; label: string; sub?: string; icon?: unknown; badge?: string |
number; accessibleLabel?: string; data?: unknown; dotColor?: string; group?: string; disabled?:
boolean }` — the row shape used by the async `source` path. `icon` renders as a decorative leading
visual, `badge` as trailing metadata, `accessibleLabel` can provide richer spoken text than the
visible label, and `data` is retained without being rendered for retrieval through `selectedRows`.
The light-DOM `<lr-option>` path normalizes its supported label/sub/dot/group fields to the same
internal row model.

**Events:** typing in the filter exposes the original bubbling/composed, non-cancelable `InputEvent`
as exactly one host `input` event and does not fire `change`. An actual user selection mutation —
pointer or keyboard selection, multiple-value toggle, tag/Backspace removal, or clear — emits exactly
one bubbling/composed, non-cancelable plain `input` `Event`, immediately followed by the same shape
of `change` `Event`. Re-picking the current single value and programmatic/default/reset/restore
writes are silent. The clear button emits one `lr-clear` after its `input`/`change` pair.
`lr-filter` (`detail: { value: string }`) reports the in-progress filter text on every user-driven
keystroke — the live as-you-typed search string, deliberately *not* `value`, which is the committed
selection. It is the supported way to read that text; reaching into the shadow root for
`[part="combobox-input"]`'s value is not. Named `lr-filter` rather than `lr-input` precisely because
`lr-input`'s detail on `<lr-input>` is the committed value, and the two must not share a name while
carrying different strings. It fires for user input only: picking a row, the clear button,
`form.reset()`, dismissing the listbox, a programmatic `value` write, and `setRangeText()` all blank
the filter silently, mirroring how `<lr-input>`'s `lr-input` only reports user edits.

`lr-show` and `lr-hide` report listbox visibility transitions.
The internal input's `focus` and `blur` are re-dispatched as bubbling, composed host events.

**The clear button covers two axes, and announces only the one that moved.** A combobox owns both a
committed selection and an in-progress filter query, so the button renders whenever either has
something to clear, and one press clears both:

- Clearing a selection emits `input`, then `change`, then `lr-clear` — and, if the query was also
  non-empty, `lr-filter` with an empty `value`.
- A **query-only** clear (nothing selected, just typed text) emits `lr-filter` with an empty
  `value` and deliberately **no** `change` and **no** `lr-clear`. There was no selection
  transition to report, so announcing one would be a lie. Don't listen for `lr-clear` to detect
  "the user emptied the field" — listen for `lr-filter` when you care about the query.
- The query half of the render gate is scoped to states where the query is actually *visible*: an
  open listbox in single-select, or any time in `multiple` mode. A closed single-select shows the
  selected label rather than the query, so a stale query alone never surfaces a button offering to
  clear text the user cannot see.

**Slots:** default (`<lr-option>` children), `label`, `hint`, `error` (overrides the `errorText`
attribute when provided), plus two adornment slots:
- `start` — content at the inline-start of the trigger row, before the selected-value tags and the
  filter input. It is decorative chrome, **not** an option: only `<lr-option>` elements in the
  default slot are ever collected into the option list.
- `end` — content after the filter input and the built-in clear action, and before the expand icon,
  so consumer content never sits outboard of the dropdown chevron.

**CSS parts:** `form-control`, `form-control-label`, `combobox`, `start` and `end` (the two
adornment-slot wrappers, each `hidden` while nothing is slotted into it), `tags`, `tag`,
`tag__remove-button`, `combobox-input`, `clear-button`, `expand-icon`, `listbox`, `option`,
`option-dot` (the leading status dot, when a row's `dotColor` is set), `option-icon` (the decorative
leading visual for an async row), `option-label`, `option-sub` (a row's secondary line, when `sub`
is set), `option-badge` (an async row's trailing metadata), `option-overflow` (the "+N more"
indicator from `maxRender`), `error`, `hint`

**Themeable custom properties:** `--lr-combobox-trigger-padding`,
`--lr-combobox-trigger-min-height`, `--lr-combobox-font-size`, `--lr-combobox-tag-padding`,
`--lr-combobox-tag-font-size`, and `--lr-combobox-expand-size` (the decorative icon box; each
standard size supplies an aligned default), plus shared tokens.

`--lr-combobox-option-active-bg` (default `var(--lr-color-brand-quiet)`) recolors the background of
a hovered or keyboard-active `[part='option']` row — the same per-component indirection
`lr-select`'s identical `--lr-select-option-active-bg` uses, so a consumer can retheme just this
row state without hijacking the shared `--lr-color-brand-quiet` token library-wide.

`--lr-combobox-trigger-height` pins an **exact** input-container height (both floors and caps it),
for pixel-matching an `<lr-input>` or `<lr-select>` in the same toolbar row. It is **undeclared by
default**, leaving `--lr-combobox-trigger-min-height` as a floor only and the row free to grow —
see "exact-height hatches" under `lr-input` for why `auto` is not a way to opt back out. Intended
for a single-row combobox: in `multiple` mode, a tag row long enough to wrap overflows the pinned
box visibly (nothing is clipped or made unreachable), so leave it unset there.

**Optional peer deps:** none.

### `lr-option`

**Properties:**
- `value: string = ''`
- `disabled: boolean = false`
- `selected: boolean = false` (reflected — set by the parent combobox, but also **read** on initial
  mount, see below)
- `group: string = ''` (section header)
- `searchText: string = ''` (attribute `search-text` — extra text the filter matches beyond the
  visible label)
- `sub: string = ''` (optional secondary line rendered under the label, e.g. a status/date summary)
- `dotColor: string = ''` (attribute `dot-color` — optional CSS color for a small leading status
  dot, any valid CSS color)
- `label` is a **read-only getter**: explicit `label` attribute wins, else trimmed `textContent`.

```html
<lr-combobox id="cb" label="Country" placeholder="Search…" with-clear>
  <lr-option value="fr">France</lr-option>
  <lr-option value="de" search-text="deutschland">Germany</lr-option>
</lr-combobox>
<script type="module">
  document.getElementById('cb').addEventListener('change', (e) => console.log(e.target.value));
</script>
```

```html
<!-- Async data source instead of light-DOM <lr-option> children: -->
<lr-combobox id="cb2" label="Fruit (async)" with-clear></lr-combobox>
<script type="module">
  document.getElementById('cb2').source = async (query) => {
    const rows = await fetchFruit(query); // your own lookup
    return rows.map((r) => ({
      value: r.id,
      label: r.name,
      icon: renderFruitIcon(r),       // decorative; hidden from assistive technology
      badge: r.category,
      accessibleLabel: `${r.name}, ${r.category}`,
      data: r,                        // retained in cb2.selectedRows after selection
    }));
  };
</script>
```

Multi-select submits as **repeated `FormData` entries** (not a joined string) —
`new FormData(form).getAll(name)` behaves like a native multi-value control. An unnamed multi-select
(`multiple` with no `name`) contributes nothing to the form at all, matching a nameless native
`<select multiple>`, rather than falling back to a shared literal key that could collide with
another unnamed combobox in the same form.
Session-history/autofill state is stored as a name-independent JSON string array. A valid string
array restores the selection (single mode keeps its first entry); malformed or wrong-shape state
restores an empty selection. Restored state wins even when it arrives before the first option
collection, while `form.reset()` still returns to the declarative selected default. Restoration is
synchronous and fires no `input`/`change` event.

**Known gotchas:**
- `with-clear` remains supported for compatibility, but new code should use the mirrored
  `clearable` property/attribute.
- a host-level `aria-label` attribute on `<lr-combobox>` now takes priority over `label`/
  `placeholder`/`"Combobox"` when resolving the accessible name on `[part="combobox-input"]` —
  previously it was silently ignored. Matches the same fallback on `<lr-select>`.
- `aria-required` reflects `required` immediately; `aria-invalid`, by contrast, only reflects
  **after the field has been touched** (first `blur`) — a `required` field with a validity error
  doesn't look invalid to assistive tech before that, by design (avoids flashing invalid styling on
  first render). Blurring the input (Tab away) now also closes an open listbox, the same as a
  native `<select>`'s popup, not just a click outside or Escape.
- `dotColor`/`sub`/`group` are read from light-DOM `<lr-option>` children as before, but are also
  first-class fields on `ComboboxSourceRow` for the async `source` path — an async lookup can drive
  the same grouped/dot/sub-text rendering a static option list can.
- `icon`, `badge`, `accessibleLabel`, and `data` are async-source row features rather than
  `<lr-option>` properties. Icons are decorative (`aria-hidden`); use `accessibleLabel` when the
  visible label/sub/badge combination needs a fuller spoken name. `data` is deliberately opaque and
  is available only through the read-only `selectedRows` getter.
- Full ARIA 1.2 combobox pattern (`role=combobox`, roving `aria-activedescendant`, real DOM focus
  kept on the input) is implemented correctly — a genuine strength, safe to build on. Declaratively-
  selected options (`<lr-option value="b" selected>`) are seeded into the selection (mirroring
  native `<select><option selected>`) both the first time options are collected **and** for any
  later batch slotted in afterward (e.g. a lazily-populated list appended post-connect) — only the
  `form.reset()` default itself is captured exclusively from that very first pass; a later pick, or
  a later batch of newly-`selected` options, never redefines what a reset restores to.

---

## `lr-select`

A plain closed-list dropdown — a direct `<lr-*>` counterpart to `<wa-select>`/`<wa-option>`.
**Form-associated** (hand-rolled internals, not the shared `FormAssociated` mixin — same reasoning
as `lr-combobox`, see the shared-foundation notes above). The trigger is a `<button>`, not a text
input: click/Enter/Space/ArrowDown opens it, and there's no typing-to-filter. Options are
`<lr-option value>` children — the same element `<lr-combobox>` uses — reconciled the same way
combobox does, and the popup reuses `internal/positioner.ts` for placement.
Session-history/autofill restoration assigns the stored string through the same synchronous
value/form/validity path as a programmatic value write and does not emit `input` or `change`.

Single-select only, with no `filter`/`source`/`with-clear`/`max-options-visible`/`empty-text`/
`max-render`/`multiple` surface — reach for `<lr-combobox>` instead whenever any of those apply.

**Single-option auto-commit.** Opt-in via `autoCommitSingleOption` (default `false` — a select always
renders the normal combobox/listbox/chevron trigger unless enabled, matching pre-1.3.0 behavior).
When set and exactly one option is enabled (regardless of how many disabled ones exist alongside
it), the popup never opens at all: a click, Enter, Space, ArrowDown, or ArrowUp on the trigger
commits that sole option directly, and the trigger renders as a plain `role="button"` with no
chevron/`aria-haspopup`/`aria-expanded`/`aria-controls`/`aria-activedescendant` rather than a
combobox with a permanently inert popup state — opening a one-row list to pick the only available
choice is pure friction with no real decision behind it. It never changes `value`/validity defaults
on its own: an unselected single-option select stays unselected (and a `required` one stays invalid)
exactly like the multi-option case, until the trigger is actually activated.

**Properties:**
- `placeholder: string = ''`
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `name: string = ''`
- `label: string = ''`
- `hint: string = ''`
- `errorText: string = ''` (attribute `error-text` — static error copy shown below the hint;
  overridden by slotted `error` content when provided)
- `open: boolean = false` (reflected)
- `size: '2xs'|'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected — same scale as `lr-input`/`lr-combobox`'s
  `size`, for compact toolbar placements that don't fit the default trigger height)
- `autoCommitSingleOption: boolean = false` (attribute `auto-commit-single-option`) — opts in to the
  single-option auto-commit behavior described above
- `value: string` — a getter/setter; always a single string (no `multiple` mode)

**Events:** `change` (native-style — selection changed), `input` (fired alongside `change` on every
selection change — a native `<select>` doesn't meaningfully distinguish the two either),
`lr-show`, `lr-hide`

**Slots:** default (`<lr-option>` children), `label`, `hint`, `error` (overrides the `errorText`
attribute when provided)

**`lr-select` deliberately has no `start`/`end` adornment slots**, unlike
`lr-input`/`lr-combobox`/`lr-date-input`. Two reasons, both structural rather than incidental:
its `[part='trigger']` is a native `<button>`, and HTML's content model forbids interactive
descendants inside one — so the slot could only ever accept decorative content, a materially
different contract from the other three that would read as the same feature; and the trigger lays
out with `justify-content: space-between`, so injecting a leading element pushes the selected label
into the middle of the control instead of leaving it at the start. **Instead:** put a glyph in the
`label` slot, or compose the select into `<lr-control-group>` alongside the adornment.

When hint/error content is present, the trigger's `aria-describedby` references stable shadow-local
IDs for both messages (error first, then hint), so the visible supporting text is part of the
control's accessible description.

**CSS parts:** `form-control`, `form-control-label`, `trigger`, `listbox`, `group-label` (a heading
row emitted inside the listbox whenever an option's `group` differs from the previous one's — a
presentational `<div>`, not a `role="group"`; options with an empty `group` get no heading),
`option`, `option-dot` (the leading status dot, when a row's `dotColor` is set), `option-label`,
`option-sub` (a row's secondary line, when `sub` is set), `expand-icon`, `error`, `hint`

**Themeable custom properties:** `--lr-select-trigger-padding`, `--lr-select-trigger-min-height`,
`--lr-select-font-size`, `--lr-select-expand-size` — all four auto-swapped per `size` (`xs`…`xl`), the same pattern
`lr-toast-item`'s `--lr-toast-padding`/`--lr-toast-font-size` use.

`--lr-select-trigger-min-height` is live at **every** tier, the default `m` included, where it is
`2.5rem` — byte-identical to `lr-input`'s and `lr-combobox`'s own `m` floor, so the three controls
agree at that tier. It used to be dead code: the component declared `--lr-select-trigger-height:
auto` on `:host`, and a *declared* value (`auto` is one) wins over the `var()` fallback arm that
the floor lives in, so the floor never applied and four extra specificity rules existed only to
patch it back for four of the tiers. Those rules are gone.

`--lr-select-trigger-height` pins an **exact** trigger height — both a floor and a cap — e.g. to
pixel-match a sibling text field in the same toolbar row. It is **undeclared by default**, which is
exactly what keeps the per-tier floor alive; see "exact-height hatches" under `lr-input`. Because
the component never declares it, it can be set inline, from an ancestor, or from an outer-tree
rule. One consequence worth knowing when testing:
`getComputedStyle(el).getPropertyValue('--lr-select-trigger-height')` now reads `''` rather than
`'auto'` — assert the rendered `min-block-size`/`block-size` instead of the property string.

`--lr-select-option-active-bg` (default `var(--lr-color-brand-quiet)`) recolors the background of a
hovered or keyboard-active `[part='option']` row. Not declared on `:host`, so a value set on any
ancestor is never shadowed — retheme just this row state without hijacking the shared
`--lr-color-brand-quiet` token every other component's own hover/active state also reads. Same
knob `lr-combobox`'s own `--lr-combobox-option-active-bg` provides.

**Optional peer deps:** none.

```html
<lr-select id="sel" label="Fruit" placeholder="Pick one…">
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b" selected>Banana</lr-option>
</lr-select>
<script type="module">
  document.getElementById('sel').addEventListener('change', (e) => console.log(e.target.value));
</script>
```

**Known gotchas:**
- The trigger keeps real DOM focus throughout — the listbox's "active" row is conveyed via
  `aria-activedescendant`, never actual focus, matching the WAI-ARIA "select-only combobox" pattern
  (as opposed to `lr-combobox`'s editable-input pattern).
- No typing-to-filter, but a printable keypress still jumps to (while open) or directly selects
  (while closed) the next non-disabled option whose label starts with what's been typed, matching a
  native `<select>`'s own type-ahead; the buffer resets ~500ms after the last keystroke.
- Declaratively-selected options (`<lr-option value="b" selected>`) seed the initial selection
  (mirroring native `<select><option selected>`) both the first time options are collected and for
  any later-slotted batch — only that very first pass' declared selection becomes the
  `form.reset()` default, the same rule `lr-combobox` follows.
- `aria-required` on the trigger reflects `required` immediately; `aria-invalid` only reflects once
  the trigger has been blurred (touched) at least once, mirroring `lr-combobox`'s own input.
  Blurring the trigger (Tab away) closes an open listbox, the same as a native `<select>`'s popup.
- The trigger's accessible name now checks a host-level `aria-label` attribute first, before falling
  back to `label`/`placeholder`/`"Select"` — a plain `aria-label` on `<lr-select>` is no longer
  silently ignored.
- With `autoCommitSingleOption` set, a select with exactly one enabled option never exposes
  `role="combobox"`/opens a listbox at all — see "Single-option auto-commit" above.
  Testing/automation code that always expects a `role="combobox"` trigger, or that opens the
  listbox before asserting on a row, either needs at least two enabled options or should leave
  `autoCommitSingleOption` unset to observe the normal dropdown chrome.

---

## `lr-date-picker` / `lr-date-input` (+ `calendar-core.ts`)

Mirrors the core `<wa-date-picker>`/`<wa-date-input>` API under `lr-`. **Value is always ISO
8601**: `YYYY-MM-DD` (single) or `YYYY-MM-DD/YYYY-MM-DD` (range).

### `lr-date-picker`

Inline month-grid calendar, not form-associated (used standalone or embedded inside
`lr-date-input`'s popover).

**Properties:**
- `value: string = ''`
- `mode: 'single'|'range' = 'single'` — unknown runtime values fall back to `single`
- `min: string = ''`
- `max: string = ''`
- `disabled: boolean = false` (reflected)
- `readonly: boolean = false` (reflected)
- `months: 1|2 = 1` — finite runtime values are truncated and clamped to `1..2`; non-finite
  values fall back to `1`
- `locale: string = ''` — malformed locale tags fall back to the platform locale
- `firstDayOfWeek: string = 'auto'` (attribute `first-day-of-week` — see gotchas)
- `weekdayFormat: 'narrow'|'short'|'long' = 'short'` (attribute `weekday-format`; unknown runtime
  values fall back to `short`)
- `disablePast: boolean = false` (attribute `disable-past`)
- `disableFuture: boolean = false` (attribute `disable-future`)
- `withOutsideDays: boolean = false` (attribute `with-outside-days`)
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — scales calendar cell density
  proportionally; unlike `lr-input`'s row-height scale (text containers), this scales cell density
  itself (fewer/more days per visual unit). Month title, weekday labels, and nav buttons stay fixed
  across tiers.
- `previousLabel: string = 'Previous month'` (attribute `previous-label` — accessible label for the
  previous-month nav button; override for a non-English `locale`)
- `nextLabel: string = 'Next month'` (attribute `next-label` — accessible label for the next-month
  nav button)

**Getters:** `selection: { from: Date|null; to: Date|null }`, `valueAsDate: Date | null` (single
mode only)

**Methods:** `clear()`, `goToToday()`, `goToDate(date: string | Date)` (valid dates are clamped to
`min`/`max` before navigating/focusing; invalid `Date` objects and strings are ignored)

**Events:** `input` (during interaction — for range mode, fires after the first click of a pair),
`change` (committed value)

**Slots:** none.

**CSS parts:** `base`, `month`, `header`, `title`, `previous`, `next`, `weekdays`, `weekday`,
`grid`, `week`, `day`, `day-outside`, `day-today`, `day-selected`, `day-range-start`,
`day-range-end`, `day-range-inner`, `day-placeholder`

**Themeable custom properties:** `--lr-cell-size` (default `2.25rem`, controls day-cell/grid-column
size; auto-scaled per `size` tier — `2xs`/`xs`/`s`/`l`/`xl`; `m` keeps the `:host` default).

**Optional peer deps:** none.

### `lr-date-input`

Text field + calendar popover, **form-associated** via the shared `FormAssociated` mixin (`name`,
`value`, `disabled`, `required` all inherited).

**Properties (own):**
- `mode: 'single'|'range' = 'single'`
- `min: string = ''`
- `max: string = ''`
- `readonly: boolean = false` (reflected; preserves the submitted value but bars required and
  date-bound constraint validation until removed)
- `open: boolean = false` (reflected)
- `withClear: boolean = false` (attribute `with-clear`)
- `label: string = ''`
- `hint: string = ''`
- `placeholder: string = ''`
- `locale: string = ''` — malformed locale tags fall back to the platform locale
- `months: 1|2 = 1` — finite runtime values are truncated and clamped to `1..2`; non-finite
  values fall back to `1`
- `firstDayOfWeek: string = 'auto'`
- `weekdayFormat: 'narrow'|'short'|'long' = 'short'` — unknown runtime values fall back to `short`
- `disablePast: boolean = false` (attribute `disable-past`)
- `disableFuture: boolean = false` (attribute `disable-future`)
- `withOutsideDays: boolean = false` (attribute `with-outside-days`)

**Properties (own, continued):**
- `errorText: string = ''` (attribute `error-text` — static error copy; overridden by slotted
  `error` content when provided)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the internal
  `<input>`'s computed accessible name; wins over `label`/`placeholder`/the localized `date`
  fallback in that order. Attribute-reflects from a host-level `aria-label` so a plain-markup
  consumer gets ARIA-name forwarding without setting a JS property.
- `clearLabel: string = 'Clear'` (attribute `clear-label` — accessible label for the clear button)
- `openLabel: string = 'Open calendar'` (attribute `open-label` — accessible label for the
  calendar-toggle button)
- `dialogLabel: string = 'Choose date'` (attribute `dialog-label` — accessible name for the
  `role="dialog"` calendar popover)
- `spellcheck: boolean = true` — forwarded to the internal `<input>`
- `autocapitalize: string = ''` — forwarded to the internal `<input>`; empty omits the attribute
- `autoCorrect: string = ''` (attribute `autocorrect`, Safari/WebKit-specific) — forwarded to the
  internal `<input>`; empty omits the attribute. Named `autoCorrect` in JS/TS (not `autocorrect`)
  to dodge a `lib.dom.d.ts` collision with `HTMLElement`'s own boolean `autocorrect` IDL member;
  the wire attribute is still the plain `autocorrect` name
- `autocomplete: string = ''`, `inputMode: string = ''` (attribute `inputmode`), and
  `enterKeyHint: string = ''` (attribute `enterkeyhint`) — forwarded to the internal date input
- `autocomplete: string = ''`, `inputMode: string = ''` (`inputmode`), and `enterKeyHint: string = ''`
  (`enterkeyhint`) — forwarded to the internal `<input>`.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — visual size, matching
  `lr-input`/`lr-select`/`lr-combobox`'s shared scale. Governs the field's padding and font-size;
  the calendar-toggle and clear buttons keep a constant, accessible touch target at every size.
  The default `m` tier is unchanged from this component's pre-`size` rendering.

**Methods:** `show()`, `hide()`, `clear()`, `focus(options?)`, `blur()`, `select()`,
`setSelectionRange()`, `setRangeText()` (all of the focus/selection methods forward to the internal
native date `<input>`).

**Getters:** `input: HTMLInputElement | undefined` — the internal native `<input>`, for direct DOM
access.

**Selection properties:** `selectionStart`, `selectionEnd`, and `selectionDirection` mirror the
internal native date input.

**Events:** `input`, `change`, `lr-show`, `lr-hide`, `lr-clear`, `blur` (re-dispatched from
the internal `<input>`'s own `blur`, bubbling and composed unlike the native event), `focus`
(re-dispatched from the internal `<input>`'s own `focus`, for the same reason as `blur`)

**Slots:** `label`, `error` (overrides `errorText`), `hint`, plus two adornment slots:
- `start` — content at the inline-start of the input row, before the text field.
- `end` — content after the text field and the built-in clear action, and before the calendar
  toggle, so consumer content never sits outboard of the calendar button.

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `start` and `end`
(the two adornment-slot wrappers, each `hidden` while nothing is slotted into it), `clear-button`,
`expand-button`, `expand-icon`, `popup`, `date-picker`, `error`, `hint`

**Themeable custom properties:** `--lr-date-input-padding-block` (default `--lr-space-xs`) and
`--lr-date-input-padding-inline` (default `--lr-space-s`) — the `input-wrapper`'s padding;
`--lr-date-input-font-size` (default `inherit`) — the `input` part's font size;
`--lr-date-input-control-min-height` (default `--lr-size-2-5rem`) — the `input-wrapper`'s block-size
floor. All four are declared on `:host` and auto-swapped per `size`
(`2xs`/`xs`/`s`/`l`/`xl`; `m` keeps the `:host` defaults), using the same per-`size` values
`lr-input` uses. Plus shared tokens.

`--lr-date-input-control-height` pins an **exact** `input-wrapper` height (both floors and caps it).
It is **undeclared by default**, so the row grows to fit its content — see "exact-height hatches"
under `lr-input`. Pinning it *below* the calendar toggle's 24×24 target is safe: the toggle keeps
its own `--lr-icon-button-size` floor and simply overflows a short row rather than shrinking, so
WCAG 2.2 SC 2.5.8 is preserved either way.

**Height parity with `lr-input` is density parity, not pixel parity.** The per-`size` padding and
font-size scale is shared with `lr-input`, so the two look equally dense at a given `size` — but a
same-`size` pair does **not** end up the same height, and code that assumes it will be
disappointed at the small tiers. `[part='input-wrapper']` carries no intrinsic `min-block-size` of
its own, while `[part='expand-button']` pins `min-block-size: var(--lr-icon-button-size)` that is
deliberately **not** gated by `size` — the calendar toggle must keep a 24×24 touch target at every
tier, and `lr-input`'s own password-toggle floors identically. So the row height is pinned
transitively by that button: at `size="s"` an `lr-input` floors at `1.875rem`/30px, while an
`lr-date-input` cannot go below roughly 40px plus its padding. Every default value of
`--lr-date-input-control-min-height` sits below that transitive height, which means the floor is
inert until you raise it past the button — a lower value changes nothing. To line the two controls
up exactly, either raise `lr-input`'s floor to meet the date input, or lower
`--lr-theme-icon-button-size` on a common ancestor (never below 24px).

**Optional peer deps:** none.

```html
<lr-date-input id="di" label="Start date" with-clear name="start"></lr-date-input>
<script type="module">
  const di = document.getElementById('di');
  di.value = '2026-07-10';
  di.addEventListener('change', () => console.log(di.value)); // ISO string
</script>
```

`calendar-core.ts` exports the pure date math both components share (**internal — not re-exported
from the package root**, but worth knowing when reasoning about behavior): `parseISO`, `formatISO`,
`isSameDay`, `addMonths`, `addMonthsClampingDay(date, n)` (like `addMonths` but clamps the result to
the target month's last day instead of overflowing into the month after — e.g. Jan 31 + 1 month
lands on Feb 28/29, not Mar 3; backs `lr-date-picker`'s PageUp/PageDown), `clampDate`,
`monthMatrix(year, month, firstDayOfWeek)`, `weekdayLabels(firstDayOfWeek, format, locale)`,
`monthTitle(year, month, locale)`, `resolveFirstDayOfWeek(value, locale?)`,
`normalizeCalendarMode(value)`, `normalizeCalendarMonths(value)`, `normalizeWeekdayFormat(value)`,
and `dateTimeFormat(locale, options)`.

**Known gotchas:**
- `first-day-of-week="auto"` now derives from `locale` when the runtime's `Intl.Locale` exposes
  week-info (`weekInfo`/`getWeekInfo()`, still shifting between engines) — `resolveFirstDayOfWeek()`
  only hardcodes Sunday as the fallback when that isn't available or `locale` is unset. A
  French/German-locale user with a supporting runtime now gets the Monday-first grid their OS would
  show; on an older runtime it still falls back to Sunday-first silently. **If you need a guaranteed
  locale-correct week start regardless of runtime**, pass an explicit
  `first-day-of-week="mon"` (accepted values: `sun`/`mon`/`tue`/`wed`/`thu`/`fri`/`sat`).
- Runtime attribute/property inputs are normalized before calendar math or `Intl` formatting:
  unsupported modes and weekday formats use their documented defaults, month counts cannot exceed
  the two-grid API, malformed locale tags use the platform locale, and invalid `Date` objects do
  not replace the current view.
- (date-input only) — opening the calendar does not move focus into it: `Alt+ArrowDown` leaves focus
  on the text input, and the expand button keeps focus when clicked. The focused opener is
  remembered. Escape and a finalized calendar selection close the popup and return focus to that
  same connected element; a direct `.open = false` also restores it when focus would otherwise
  remain inside the now-hidden popup. Outside-pointer dismissal deliberately leaves focus at the
  clicked target.
- (date-input only) — typing an unparseable string and blurring/committing sets `badInput` via
  `internals.setValidity()` and reverts the displayed text to the last valid commit. The visible
  `<input part="input">` mirrors `required` through native `required`/`aria-required` and exposes
  touched outer validity through `aria-invalid`; this includes required, bad-input, and range
  failures owned by the form-associated host. A host `aria-label` is reactively forwarded to the
  input, including later changes/removal, and takes precedence over the component's
  label/placeholder fallback. Native validation attempts reveal `aria-invalid`; `form.reset()`
  clears that touched presentation. A parseable typed date outside an active bound is committed
  instead and reports the precise `rangeUnderflow`/`rangeOverflow` state.
- (date-input only) — declarative, IDL, reset, and restored values are sanitized to exact ISO dates:
  calendar-invalid or malformed strings become `''` (and therefore `valueMissing` when required),
  while valid dates outside `min`/`max` or `disable-past`/`disable-future` remain submitted and expose
  `rangeUnderflow`/`rangeOverflow`. Changes to these constraints, `mode`, and `readonly` recompute
  validity synchronously; range mode validates both endpoints.
- The grid keyboard pattern (Arrow/PageUp/PageDown/Home/End navigation with correct focus
  sequencing) is implemented correctly and safe to rely on, as is the selected/range-day text color
  (`--lr-color-on-brand`, not a hardcoded literal — safe to override `--lr-color-brand` without
  losing contrast on selected-day text).

---

## lr-textarea

A multiline plain-text input primitive, form-associated (participates in native `<form>`
submission/validation/reset via `name`/`value`/`disabled`/`required`/`checkValidity()`/
`reportValidity()`). Ships an opt-in `label`/`hint`/`errorText` form-control chrome mirroring
`lr-select` -- left unset, none of it renders.

```html
<lr-textarea placeholder="Notes" rows="4"></lr-textarea>
```

### Properties

| Property | Attribute | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `value` | `string` | `''` | The current text value. |
| `rows` | `rows` | `number` | `3` | Visible text rows. |
| `resize` | `resize` | `'none' \| 'vertical' \| 'both' \| 'auto'` | `'vertical'` | Native CSS `resize` behavior, plus `'auto'` (`ResizeObserver`-driven grow-to-content, no manual handle). |
| `placeholder` | `placeholder` | `string` | `''` | Placeholder text. |
| `label` | `label` | `string` | `''` | Visible label text. Unset: no label chrome renders. |
| `hint` | `hint` | `string` | `''` | Hint text below the field. |
| `errorText` | `error-text` | `string` | `''` | Error text below the field (overridden by slotted `error` content). |
| `accessibleLabel` | `aria-label` | `string \| null` | `null` | Accessible-name override forwarded to the internal `<textarea>`; wins over `label`, `placeholder`, and the localized default. |
| `spellcheck` | `spellcheck` | `boolean` | `true` | Forwarded to the native `<textarea>`. |
| `autocapitalize` | `autocapitalize` | `string` | `''` | Forwarded to the native `<textarea>`; empty omits the attribute. |
| `autoCorrect` | `autocorrect` | `string` | `''` | Forwarded to the native `<textarea>` (Safari/WebKit-specific); empty omits the attribute. |
| `wrap` | `wrap` | `'hard' \| 'soft' \| 'off'` | `'soft'` | Native line-wrapping/submission behavior. |
| `autocomplete` | `autocomplete` | `string` | `''` | Forwarded to the native `<textarea>`; empty omits the attribute. |
| `inputMode` | `inputmode` | `string` | `''` | Virtual-keyboard input hint forwarded to the native `<textarea>`. |
| `enterKeyHint` | `enterkeyhint` | `string` | `''` | Virtual-keyboard Enter-key hint forwarded to the native `<textarea>`. |
| `name` | `name` | `string` | `''` | Form field name. |
| `disabled` | `disabled` | `boolean` | `false` | Disables the control. |
| `required` | `required` | `boolean` | `false` | Participates in native constraint validation. |

The visible label, hint, and error live in the same shadow tree as the native control, so their
generated ids safely drive the native `<label>`/`aria-describedby` relationships. Name precedence
is `accessibleLabel`/host `aria-label`, visible `label`, `placeholder`, then the localized
`textareaLabel` message. External `aria-labelledby`/`aria-describedby` idrefs are not copied across
the shadow boundary.

### Getters and selection properties

- `input: HTMLTextAreaElement | null` — the internal native control.
- `selectionStart: number | null`, `selectionEnd: number | null`, and
  `selectionDirection: 'forward'|'backward'|'none'|null` — readable and writable passthroughs to
  the native selection state.
- The shared form-associated getters `form`, `labels`, `validity`, `validationMessage`,
  `willValidate`, and `effectiveDisabled` are also available.

### Methods

| Method | Description |
| --- | --- |
| `focus(options?)` / `blur()` | Focus or blur the internal native control. |
| `select()` | Select all text. |
| `setSelectionRange(start, end, direction?)` | Set the native selection range and optional direction. |
| `setRangeText(replacement, start?, end?, selectMode?)` | Apply a native range edit, then synchronize the component `value`, form value, validity, and auto-grown size without emitting a user event. |
| `setFormValue(value)` | Set the reactive and submitted value synchronously. |
| `checkValidity()` / `reportValidity()` | Run native constraint validation through `ElementInternals`. |

### Events

| Event | Detail | Description |
| --- | --- | --- |
| `lr-input` | `{ value: string }` | Fired on every user-driven edit. |
| `lr-change` | `{ value: string }` | Fired on native `change` timing (blur after a committed edit). |
| `blur` | none | Re-dispatched from the internal native `<textarea>`'s own `blur` -- bubbling and composed, unlike the native event. |
| `focus` | none | Re-dispatched from the internal native `<textarea>`'s own `focus`, for the same reason as `blur`. |

Programmatic property assignments, selection changes, `setRangeText()`, form reset, and form-state
restoration are silent. User edits update `value`, submitted form data, and required validity before
the corresponding `lr-input`/`lr-change` event is dispatched. `form.reset()` restores the
original declarative `value`, matching native `defaultValue` behavior.

### Slots

| Slot | Description |
| --- | --- |
| `label` | Custom label content. |
| `hint` | Custom hint content. |
| `error` | Custom error content. |

### CSS Parts

| Part | Description |
| --- | --- |
| `form-control` | The outer wrapper around label, textarea, error and hint. |
| `form-control-label` | The `<label>` element. |
| `textarea` | The native `<textarea>` element. |
| `hint` | The hint message. |
| `error` | The error message. |

### Themeable custom properties

- `--lr-textarea-max-block-size` (default `none`) — bounds `resize="auto"`; content beyond the
  bound scrolls inside the native textarea. Auto-resize remeasures after user edits, programmatic
  `value`/`rows` changes, range edits, and container-width changes.

---

## `lr-button`

A generic action-button primitive. Renders an internal native `<button>`; `type="submit"`/
`type="reset"` are handled by the component itself via the host's own `closest('form')`, since a
shadow-internal native button doesn't participate in an ancestor form's submission on its own.

**Properties:**
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected)
- `appearance: 'accent' | 'filled' | 'outlined' | 'plain' | 'quiet' | 'link' = 'filled'` (reflected)
  — `'accent'` is a
  loud, high-contrast filled tier,
  distinct from `'filled'` for `variant="neutral"` specifically (`'filled'` reads the ambient
  surface color there; `'accent'` reads a solid neutral fill). `'quiet'` is a de-emphasized tier:
  transparent background with a bordered, muted-text chrome that fills to `--lr-color-surface` on
  hover; its text/border tokens are **not** variant-swapped, so `variant` has no effect on it.
  `'link'` is a true inline-link tier:
  zero chrome (no padding, border, border-radius, or `min-block-size` floor), underlined
  (`text-underline-offset: var(--lr-size-0-15rem)`), colored from `--lr-button-accent` (the same token `'plain'`
  uses, so `variant` still selects the link color) and inheriting the surrounding font-size/weight
  — for a text link that flows within a sentence rather than a button-shaped control. Declared
  after the per-`size` rules, so it overrides them whatever `size` is set
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — `'2xs'` is the tightest tier,
  below `'xs'`, for dense chrome; `'m'` is the standard one
- `type: 'button' | 'submit' | 'reset' = 'button'`
- `loading: boolean = false` (reflected) — shows an internal spinner and disables the button without
  clearing `disabled`
- `disabled: boolean = false` (reflected)

The shared `m` size uses `--lr-font-size-m`. The internal button follows the host's inline size through `--lr-button-width` (default
`100%`), and each size tier's `min-block-size` floor is exposed as its own token (see below).

**Getters/methods:** `click()`, `focus(options?)`, and `blur()` — forwarded to the internal native
`<button>`; `click()` also runs the component's submit/reset behavior.

**Events:** none (a plain native `click` bubbles and composes through the shadow boundary
unmodified; disabled while `disabled` or `loading`).

**Slots:** default (label content), `start` (leading icon/content), `end` (trailing icon/content).

**CSS parts:** `base`, `label`, `start`, `end`, `spinner` (present only while `loading`).

**Themeable custom properties:** `--lr-button-width`, `--lr-button-accent`, `--lr-button-fill`,
`--lr-button-on-fill`, `--lr-button-border` (each swapped by the active `variant`, default
`neutral` falls back to plain text/surface/border tokens), `--lr-button-accent-fill`,
`--lr-button-accent-on-fill` (the `appearance="accent"` fill/foreground pair; `neutral` falls
back to `--lr-color-neutral`/`--lr-color-on-neutral`, every other variant reuses that variant's own
loud fill token), `--lr-button-outlined-border` (default `--lr-color-border-strong`, the
`appearance="outlined"` border color — variant-independent, unlike `--lr-button-border`),
`--lr-button-quiet-text` (default `--lr-color-text-quiet`) and `--lr-button-quiet-border` (default
`--lr-color-border`) — the `appearance="quiet"` foreground/border pair, also variant-independent,
`--lr-button-hover-brightness` (default `1.08`, the `:hover` filter intensity),
`--lr-button-active-scale` (default `0.9875`, the `:active` press-scale, disabled under
`prefers-reduced-motion`), `--lr-button-spinner-duration` (default `1s`, the `loading` spinner's
rotation period; forced to `0.001ms` under `prefers-reduced-motion`),
`--lr-button-outlined-fill` (default `transparent`, the `appearance="outlined"` background — also
variant-independent; set it to tint an outlined button with, say, a faint surface wash behind the
outline, without a `::part(base)` rule. Note that the `:hover` `filter: brightness()` applies to
whatever fill is set, so a tinted outlined button visibly brightens on hover where a transparent
one did not),
and the per-`size`
`min-block-size` floors `--lr-button-size-2xs` (`1.25rem`), `--lr-button-size-xs` (`1.5rem`),
`--lr-button-size-s` (`1.75rem`), `--lr-button-size-m` (`2rem`), `--lr-button-size-l` (`2.5rem`),
`--lr-button-size-xl` (`3rem`) — each read only by its own `size` tier, and all ignored by
`appearance="link"`. `--lr-button-gap` (default `--lr-space-2xs`, the gap between the icon/label
and any slotted content) and `--lr-button-radius` (default `--lr-radius`, the corner radius) are
both retunable without a `::part(base)` rule but — unlike the four size knobs below — do not vary
by `size` tier; `appearance="link"` ignores `--lr-button-radius` (it renders with zero radius).

**Retuning one `size` tier's geometry, without a `::part(base)` rule.** Four more properties carry
the active tier's geometry, and every `:host([size='…'])` rule does nothing but re-assign them — no
per-tier rule ever declares a property on `[part='base']`. Overriding one therefore retunes
whatever tier is active (e.g. pinning a `size="s"` button into a compact toolbar row), the same
pattern `lr-input`/`lr-select`/`lr-combobox`/`lr-segmented`/`lr-date-input` follow. Their defaults
below are the `m` tier's values, because `size` reflects and defaults to `m`, so the `:host`
declarations *are* the `m` tier:

- `--lr-button-padding-block` (default `--lr-space-xs`)
- `--lr-button-padding-inline` (default `--lr-space-m`)
- `--lr-button-font-size` (default `--lr-font-size-m`)
- `--lr-button-min-height` (default `--lr-button-size-m`) — the active tier's `min-block-size`
  floor, re-assigned per tier to that tier's own `--lr-button-size-*` token, and used as the
  fallback when `--lr-button-height` is unset.
- `--lr-button-height` — an **exact** height (both floor and cap), for pinning the button to a
  fixed toolbar row. **Undeclared by default**, so the button keeps the active tier's floor and an
  `auto` height; see "exact-height hatches" under `lr-input`.

`appearance="link"` ignores all five: it is declared after the `size` rules and resets padding,
font, and both height properties with literals, so an inline link can never take a button-shaped
box no matter what tier or override is in play.

**Optional peer deps:** none.

```html
<lr-button variant="brand" appearance="filled">Save</lr-button>
<lr-button variant="neutral" appearance="accent">Save</lr-button>
<lr-button appearance="plain" aria-label="Close dialog"><svg slot="start">...</svg></lr-button>
<p>The message failed. <lr-button appearance="link" variant="brand">Retry</lr-button></p>
```

**Known gotchas:**
- A host `aria-label` is forwarded to the internal button as a literal string (for an icon-only
  button); an external `aria-labelledby`/`aria-describedby` idref is not copied across the shadow
  boundary.
- Is form-associated (`static formAssociated = true` + `attachInternals()`), so it participates in
  an ancestor `<form>.elements` the same way `wa-button` does — a sibling text field's own
  Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) finds it.

---

## `lr-icon-button`

An accessible icon-only action button — a native `<button>` wrapping an `lr-icon`. Not
form-associated: it is an action trigger, so `type="submit"`/`"reset"` work through the ancestor
form the way a native button does, but the element itself contributes no form value.

**Properties:**
- `icon: string = ''` — an `lr-icon` glyph name (see `llms/components/lr-icon.md`)
- `accessibleLabel: string = ''` (attribute: `aria-label`) — the typed override for the button's
  accessible name; wins over `label`
- `label: string = ''` — accessible name when `accessibleLabel` is unset
- `disabled: boolean = false` (reflected)
- `type: 'button' | 'submit' | 'reset' = 'button'`

With neither `accessibleLabel` nor `label` set, the name falls back to the localized
`iconButtonLabel` string rather than being empty — override it per instance with `.strings` or
app-wide with `registerLyraLocale()` (see `llms/shared.md`); don't rely on the fallback for a
button whose purpose isn't generic.

**Methods:** `focus(options?)`, `blur()` — forward to the native button. `click()` also forwards to
the native button, activating it — including this component's own `type="submit"`/`type="reset"`
handling, since the click goes through the same `<button>` the pointer/keyboard path does.

**Slots:** (default) — custom icon content. It is rendered **beside** the `icon` glyph, as a
sibling of it, not piped through `<lr-icon>`: the internal `<lr-icon>` mounts only when `icon` is
set, so with `icon` left empty your content is the button's only child. That is what lets a
complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — render at its own natural aspect ratio
instead of being forced into a 1:1 box. Setting both `icon` and slotted content renders both, side
by side; that is a valid composition, not a fallback.

**Bare SVG geometry fallback:** slotted bare SVG *geometry* (`path`, `circle`, `rect`, `line`,
`polygon`, `polyline`, `ellipse`, `g`, `use`) with no `icon` set and no enclosing `<svg>` of its
own has no real SVG parent as parsed, and is detected and cloned into an internal
`[part="fallback"]` SVG-namespaced element so it still paints — the same fallback `<lr-icon>`'s own
custom-content slot uses. This is narrowly scoped to that whitelist: a complete `<svg>`, `<img>`,
or custom element (e.g. `<lr-flag>`) is never touched by it and keeps rendering as an untouched
sibling at its own natural aspect ratio.

**CSS parts:** `button`, `fallback` (only present in the DOM while at least one top-level slotted
element needs the bare-geometry fallback above)

**Themeable custom properties:** `--lr-icon-button-size` (default `2.5rem`) is the **minimum**
tappable inline and block size of the native button — a floor, not a fixed size. Content larger
than it grows the button and keeps its own aspect ratio; a small glyph pads out to it. It is a
library-wide token (declared on `:root` by the token layer, and the shared minimum tappable size
that several other components size their icon-only controls against), so overriding
`--lr-theme-icon-button-size` globally resizes all of them together. Keep the resolved value at or
above 24px — see `llms/shared.md`.

## `lr-input`

A single-line plain-text input primitive, the `lr-*` equivalent of a plain `wa-input`,
form-associated via the same `FormAssociated` mixin as `lr-textarea`. Ships the same opt-in
`label`/`hint`/`errorText` form-control chrome as `lr-textarea`/`lr-select`, and the same
`size` scale as `lr-select`/`lr-combobox`.

**Properties:**
- `type: 'text' | 'password' | 'email' | 'number' | 'time' | 'search' = 'text'`
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected)
- `value: string = ''` (from `FormAssociated`)
- `placeholder: string = ''`
- `clearable: boolean = false` (reflected) — shows a localized clear action while a `text` or
  `search` input has a value; clearing preserves input focus
- `readonly: boolean = false` (reflected) — forwarded to the native input and disables clearing
- `label: string = ''`
- `hint: string = ''`
- `errorText: string = ''` (attribute `error-text`)
- `accessibleLabel: string | null = null` (attribute `aria-label`)
- `autocomplete: string = ''`
- `spellcheck: boolean = true` — forwarded to the native input, including `spellcheck="false"`
- `autocapitalize: string = ''` / `autoCorrect: string = ''` (attribute `autocorrect`)
- `inputMode: string = ''` (attribute `inputmode`) / `enterKeyHint: string = ''` (attribute
  `enterkeyhint`) — these four are forwarded verbatim to the native input; an empty string omits
  the attribute entirely
- `min?: number` / `max?: number` (attributes `min`/`max`) / `step?: number | 'any'` (attribute
  `step`, accepts the native `'any'` value alongside a number) — forwarded verbatim to the native
  input and validated by it. Intended for `type="number"`; `step` is equally meaningful on
  `type="time"`. On `lr-input` itself the `min`/`max` *attributes* are number-converted, so a
  non-numeric bound only survives a direct property assignment; the declared type also admits a
  string so a subclass can narrow the attribute parsing to its own native type's literal form —
  `lr-time-input` does exactly that. Inert for the other types
- `passwordVisible: boolean = false` (attribute `password-visible` — `type="password"` only)
- `name`/`disabled`/`required` (from `FormAssociated`)

**Getters/methods:** `input: HTMLInputElement | null` (the internal native `<input>`, for direct DOM
access), `focus(options?: FocusOptions)`, `blur()`, `select()`. Also forwards the full native
selection/editing surface, mirroring `lr-textarea`'s identical passthrough: `selectionStart: number
| null` and `selectionEnd: number | null` (readable/writable; `null` both before the internal input
has rendered and whenever `type` doesn't support selection — only `text`/`search`/`password` do,
matching the native `<input>`'s own contract), `setSelectionRange(start, end, direction?)`
(no-op before render, otherwise throws the same native `InvalidStateError` a native `<input>` would
for an unsupported `type`), and `setRangeText(replacement, start?, end?, selectMode?)` (no-op
before render; syncs `value` afterward without emitting a user event).

**Events:** native-style composed `input` and `change`, plus `lr-input` (`detail: { value }`,
fired on every user-driven edit) and `lr-change` (`detail: { value }`, fired on the native
`change` timing), `blur`/`focus` (re-dispatched bubbling + composed from the internal native input's
own `blur`/`focus`), and `lr-clear` (no detail, fired after the clear action's `input`/`lr-input`/
`change`/`lr-change` sequence).

**Slots:** `label`, `hint`, `error`, `start` (adornment before the input), `end` (adornment after the
input and built-in actions).

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `password-toggle`
(present only when `type="password"`), `start`, `end`, `clear-button` (non-empty clearable
`text`/`search` inputs only), `hint`, `error`.

**Themeable custom properties:** `--lr-input-padding-block`, `--lr-input-padding-inline`,
`--lr-input-font-size`, `--lr-input-control-min-height` — all four auto-swapped per `size`
(`2xs`…`xl`), the same pattern
`lr-select`'s `--lr-select-trigger-padding`/`--lr-select-font-size` use.
`--lr-input-control-height` pins an **exact** outer control-row height (both floors and caps it) —
for example to pixel-match an `<lr-select>` or `<lr-combobox>` in the same toolbar row. It is
undeclared by default, leaving `--lr-input-control-min-height` as a floor only and the row free to
grow.

### Exact-height hatches — the one rule that applies to all of them

Several controls expose the same pair: a per-`size` `*-min-height` **floor**, and an exact
`*-height` **cap**. The family is `--lr-input-control-height`, `--lr-select-trigger-height`,
`--lr-combobox-trigger-height`, `--lr-date-input-control-height`, `--lr-button-height`,
`--lr-known-date-field-height`, and `--lr-chip-height`. Every one of them behaves identically:

- **Each is undeclared by default.** The component reads it only through two `var()` fallbacks —
  `min-block-size: var(--lr-x-height, var(--lr-x-min-height))` and
  `block-size: var(--lr-x-height, auto)` — so leaving it unset is what makes the per-tier floor
  and the content-driven height work at all.
- **Setting one to `auto` is not the same as leaving it unset.** `auto` is a perfectly valid
  *declared* value, and a declared value wins over the `var()` fallback arm — so `auto` silently
  turns the per-tier `*-min-height` floor into dead code, and nothing anywhere reports it. To
  return a control to default behavior, **remove** the declaration; never neutralize it with
  `auto`.
- Because the component itself never declares them, each can be set inline on the element, from an
  ancestor, or from an outer-tree rule (`lr-input { --lr-input-control-height: 44px }`) — no
  `::part()` rule needed.
- **A dead declaration is invisible in source.** There is no way to tell a live `--lr-*`
  declaration from a shadowed or defeated one without rendering: a test asserting on stylesheet
  text passes either way. Assert the rendered `min-block-size`/`block-size` via
  `getComputedStyle` on the real element instead of reading the custom property back.

**Optional peer deps:** none.

```html
<lr-input type="password" label="Password"></lr-input>
<lr-input type="email" label="Email" required></lr-input>
<lr-input size="s" placeholder="Compact"></lr-input>
<lr-input type="search" clearable value="workflow" aria-label="Search"><span slot="start">⌕</span></lr-input>
```

**Known gotchas:**
- `type="email"`/`type="number"` delegate constraint validation to the internal native `<input>`'s
  own browser-computed `validity` (format/range/step), bridged into this element's own
  `ElementInternals` — not a second hand-rolled regex check.
- `type="password"` always renders the `password-toggle` button; there is no separate opt-out.

## `lr-number-input`

A migration-friendly numeric alias of `lr-input` — a subclass whose constructor and
`connectedCallback()` both set `type = 'number'`. It adds no API of its own; everything below is
`lr-input`'s surface, unchanged.

**Properties:** `size` (`2xs`…`xl`), `placeholder`, `readonly`, `label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), `autocomplete`, `spellcheck`, `autocapitalize`,
`autoCorrect` (`autocorrect`), `inputMode` (`inputmode`), `enterKeyHint` (`enterkeyhint`), and
`min`/`max`/`step` (the native numeric constraint validation). `clearable` and `passwordVisible`
(`password-visible`) are inherited but inert — see gotchas.

**Events:** `input`/`change` (native-style, composed), `lr-input`/`lr-change`
(`detail: { value }`), `focus`/`blur` (re-dispatched bubbling + composed from the internal native
input), and `lr-clear` (inherited, never fired here).

**Slots:** `label`, `hint`, `error`, `start`, `end`.

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `start`, `end`,
`hint`, `error`, plus the inherited `clear-button` and `password-toggle`, neither of which this
alias ever renders.

**Themeable custom properties:** inherited from `lr-input`, identical in meaning —
`--lr-input-control-min-height`, `--lr-input-control-height`, `--lr-input-padding-block`,
`--lr-input-padding-inline` and `--lr-input-font-size` (all but `--lr-input-control-height` swap
per `size`; that one stays undeclared until you pin an exact row height).

**Known gotchas:**
- `clearable`/`clear-button`/`lr-clear` are inert: the clear action only renders for
  `type="text"`/`"search"`. `password-visible`/`password-toggle` are likewise inert, since the
  toggle only renders for `type="password"`.
- `type` is re-forced to `number` on every connect, but a later `el.type = 'text'` on a connected
  element is not reverted — use `lr-input` when the type has to change.

## `lr-time-input`

A migration-friendly time alias of `lr-input` — the same subclassing shape as `lr-number-input`,
with the constructor and `connectedCallback()` setting `type = 'time'`. Its only own API is a
re-typed `min`/`max` pair (below); every other property, event, slot and part is `lr-input`'s.

**Properties:** `size` (`2xs`…`xl`), `placeholder`, `readonly`, `label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), `autocomplete`, `spellcheck`, `autocapitalize`,
`autoCorrect` (`autocorrect`), `inputMode` (`inputmode`), and `enterKeyHint` (`enterkeyhint`).
`clearable` and `passwordVisible` (`password-visible`) are inherited but inert, exactly as on
`lr-number-input`.

`step` is forwarded verbatim to the native time input, where it means seconds (`step="1"` reveals
the seconds field, `'any'` disables step validation).

`min?: string | number` / `max?: string | number` (attributes `min`/`max`, both defaulting to
`undefined` — no bound) are re-declared here with a converter that forwards the attribute verbatim
instead of `lr-input`'s numeric parsing, so they take the native `<input type="time">` literal form:
`min="09:00"`, or `min="09:00:30"` alongside a seconds-precision `step`. Attribute and property are
interchangeable (`el.min = '09:00'` needs no cast), removing the attribute clears the bound, and the
native input's own constraint validation reports `rangeUnderflow`/`rangeOverflow` through
`checkValidity()`.

**Events:** `input`/`change` (native-style, composed), `lr-input`/`lr-change`
(`detail: { value }`), `focus`/`blur` (re-dispatched bubbling + composed), and `lr-clear`
(inherited, never fired here).

**Slots:** `label`, `hint`, `error`, `start`, `end`.

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `start`, `end`,
`hint`, `error`, plus the inherited, never-rendered `clear-button` and `password-toggle`.

**Themeable custom properties:** inherited from `lr-input`, identical in meaning —
`--lr-input-control-min-height`, `--lr-input-control-height`, `--lr-input-padding-block`,
`--lr-input-padding-inline` and `--lr-input-font-size` (all but `--lr-input-control-height` swap
per `size`; that one stays undeclared until you pin an exact row height).

**Known gotchas:** the same two as `lr-number-input` — the inert clear/password surface, and `type`
only being re-forced on connect. The native `type="time"` UI (spinners, AM/PM, picker) is the
browser's own and is not restyled by Lyra.

---

## `lr-phone-input`

A form-associated, country-aware telephone field. The submitted `value` is either canonical E.164
(for example `+352621123456`) or `''` while the editable input is empty, incomplete, or invalid.
Numbering-plan metadata and national formatting stay outside Lyra's base bundle: supply a
synchronous `PhoneNumberAdapter`, or lazily create one from a `libphonenumber-js`-compatible module
with `loadLibphonenumberAdapter()`. Without an adapter, already-international E.164 input still
normalizes and validates; national input remains editable with `incomplete` validity.

The country selector keeps the real native `<select>` (localized full country names in its popup,
native mobile pickers, keyboard type-ahead) but stretches it invisibly over a compact decorative
trigger showing the selected alpha-2 code plus a design-system chevron — long country names never
clip the closed control and the adjacent calling code isn't repeated. With `flags`, the trigger
also shows the selected country's `<lr-flag>`.

**Types:**

```ts
type PhoneNumberStatus = 'empty' | 'incomplete' | 'invalid' | 'valid';

interface PhoneCountry {
  code: string;         // ISO 3166-1 alpha-2
  callingCode: string;  // no leading "+"
  label?: string;       // overrides Intl.DisplayNames
}

interface PhoneNumberParseResult {
  status: PhoneNumberStatus;
  e164?: string;       // required for status: 'valid'
  formatted?: string;  // best-effort editable display text
  country?: string;    // detected ISO alpha-2 code
}

interface PhoneNumberAdapter {
  readonly countries?: readonly PhoneCountry[];
  parse(input: string, country?: string): PhoneNumberParseResult;
}
```

**Properties:**

- `value: string = ''` — canonical E.164 form/submission value. A programmatic assignment is parsed
  and normalized synchronously but emits no user event.
- `name: string = ''`, `disabled: boolean = false`, `required: boolean = false` — native-like
  form-control properties supplied by `FormAssociated`; inherited disabled fieldsets are included
  through `effectiveDisabled`.
- `adapter?: PhoneNumberAdapter` (attribute: false) — synchronous numbering-plan parser/formatter.
  No metadata implementation is imported by the component itself.
- `countries: readonly PhoneCountry[] = []` (attribute: false) — explicit selector rows; takes
  precedence over `adapter.countries`.
- `defaultCountry: string = ''` (attribute `default-country`) — selected when `country` has not been
  set explicitly.
- `flags: boolean = false` (reflected) — show the selected country's flag in the country trigger as
  `<lr-flag variant="compact" aria-label="">` (decorative; the native select already announces the
  country name). The `<lr-flag>` element definition is registered lazily the first time any
  `lr-phone-input` enables this, so nothing flag-related is bundled while it stays off. Flag
  *artwork* still follows the standalone `<lr-flag>` contract: install the optional
  `@aceshooting/lyra-flags` peer and import
  `@aceshooting/lyra-ui/components/media/flag/flag-peer.js` once; without that registration the
  trigger simply omits the image. The open popup list stays text-only — a native `<option>` cannot
  contain elements.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — same scale as `lr-input`'s
  `size`; scales input padding, font size, and wrapper min-height; `size="s"` shares its outer
  control height with `lr-input`, `lr-select`, and `lr-combobox` without part overrides)
- `country: string` — current uppercase ISO alpha-2 selection; falls back to `defaultCountry`, then
  the first explicit/adapter country. Changing the country reparses the editable number.
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`) —
  visible form-field chrome; each has a matching named slot.
- `placeholder: string = ''` — forwarded to the native telephone input.
- `spellcheck: boolean = true`, `autocapitalize: string = ''`, `autoCorrect: string = ''`
  (attribute `autocorrect`) — forwarded to the internal telephone input's own `spellcheck`/
  `autocapitalize`/`autocorrect`; `spellcheck="false"` is parsed as `false` via a string-aware
  converter (Lit's default presence-based boolean converter would otherwise treat any attribute
  value, including the literal string `"false"`, as `true`).
- `accessibleLabel: string | null = null` (attribute `aria-label`) — forwarded to the internal
  telephone input. Name precedence is host `aria-label`, `phoneLabel`, visible `label`, then
  `placeholder`.
- `phoneLabel: string = ''` (attribute `phone-label`) — explicit accessible-name override for the
  native telephone input.
- `countryLabel: string = 'Select'` (attribute `country-label`) — country-selector accessible name;
  the untouched default routes through the shared localized `select` message.
- `incompleteText: string = 'The value is invalid.'` (attribute `incomplete-text`) — validation
  message for dial-like input that can still become valid with more digits. The untouched default
  routes through the shared localized `valueInvalid` message.
- `invalidText: string = 'The value is invalid.'` (attribute `invalid-text`) — completed-invalid
  message, localized through the same shared key while left at its default.
- `autocomplete: string = 'tel'`, `inputmode: 'tel'|'numeric'|'text' = 'tel'`,
  `enterkeyhint: string = ''` — forwarded to the internal `<input type="tel">`.
- readonly `input: HTMLInputElement | undefined` — the internal native telephone input.
- readonly `inputValue: string` — editable formatted/partial text, which remains available even when
  canonical `value` is `''`.
- `selectionStart`, `selectionEnd`, and `selectionDirection` — native selection getters/setters
  forwarded to the telephone input
- readonly `phoneStatus: PhoneNumberStatus` — current parse state. The host also reflects it through
  `data-phone-status`.
- readonly `form`, `labels`, `validity`, `validationMessage`, `willValidate`, and
  `effectiveDisabled` — the shared form-associated native-like getters.

**Validity:** empty + `required` sets `valueMissing`; incomplete dial-like input sets `badInput`;
completed-invalid input sets `typeMismatch`; valid E.164 input clears all three. Partial or invalid
text remains in `inputValue`/the native input so validation never makes a number impossible to edit,
but its canonical submitted `value` is blank. Native validation feedback is anchored to the
telephone input, not the adjacent country selector.

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and `setRangeText()`
forward to the native telephone input. Range-text edits reparse the number and synchronize the
canonical value, form value, and validity.
`setFormValue(value)`, `checkValidity()`, and `reportValidity()` come from `FormAssociated`.
`form.reset()` restores the original declarative `value` and the default country.

**Events:**

- `input` — every user edit and country change.
- `change` — native telephone-input commit timing and every country change.
- `focus` / `blur` — bubbling, composed bridges for the internal native input's non-crossing focus
  events.

`input`/`change` detail is
`{ value: string; inputValue: string; country: string; valid: boolean; status: PhoneNumberStatus }`.
Programmatic property assignments and form reset/state restoration are silent.

**Slots:** `label`, `hint`, `error`, `country-prefix` (optional visual before the country selector,
such as a consumer-owned `<lr-flag>`; no flag package is imported automatically).

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `country-prefix`, `country`
(the selector region: invisible native select layered over the visual trigger), `country-select`,
`country-trigger` (visible, `aria-hidden` closed-state box), `flag` (the `<lr-flag>`, only with
`flags`), `country-code` (selected alpha-2 code, `data-placeholder` when no country exists),
`expand-icon`, `calling-code`, `input`, `hint`, `error`.

**Themeable custom properties:** `--lr-phone-input-padding-block`, `--lr-phone-input-font-size`,
and `--lr-phone-input-control-min-height` (each scaled by `size`), plus `--lr-phone-input-control-height`
to pin an exact input-wrapper height (both floors and caps it — use it for pixel-matching an
`<lr-input>` or `<lr-select>` in the same toolbar row; undeclared by default, leaving the min height
as a floor only). The phone-number input and calling code are deliberately `dir="ltr"`/isolated
because telephone numbers are algorithmic content; surrounding form chrome and the country selector
inherit LTR/RTL and use logical spacing/borders.

**Optional peer deps:** `libphonenumber-js` is declared optional but never imported by Lyra itself.
For full national parsing/formatting, install it in the consuming app and pass it through the
consumer-supplied lazy loader below. Because the import expression lives in consumer code, no
numbering metadata enters a bundle that does not opt in.

```ts
import '@aceshooting/lyra-ui/components/forms/phone-input/phone-input.js';
import { loadLibphonenumberAdapter } from
  '@aceshooting/lyra-ui/components/forms/phone-input/phone-input.class.js';

const phone = document.querySelector('lr-phone-input');
phone.adapter = await loadLibphonenumberAdapter(() => import('libphonenumber-js/min'));
```

```html
<lr-phone-input
  name="mobile"
  label="Mobile number"
  hint="Used only for account security"
  default-country="LU"
  required
></lr-phone-input>
```

```ts
// Country flags in the trigger (optional): same peer contract as a standalone <lr-flag>.
import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';
```

```html
<lr-phone-input label="Mobile number" flags default-country="LU"></lr-phone-input>
```

**Known gotchas:**

- An adapter's `parse()` method is synchronous because it runs on every keystroke. Load any optional
  module first, then assign the resolved adapter. Adapter exceptions degrade to the E.164-only
  fallback rather than breaking editing.
- A valid adapter result must include an E.164-shaped `e164`; a malformed "valid" result is treated
  as invalid instead of entering form submission.
- Country names use `Intl.DisplayNames` and fall back to the ISO code; set `PhoneCountry.label` for
  a product-specific name. Calling codes are data, not derived by the component.
- The component never imports `@aceshooting/lyra-flags` itself, with `flags` or without. `flags`
  lazily registers only the `<lr-flag>` element; the artwork resolver comes from the consumer's own
  `flag-peer.js` import (plus the installed peer package), so forgetting either shows a flagless
  trigger rather than erroring. `country-prefix` remains available for a fully consumer-owned
  adornment instead.
- The visible trigger (`country-trigger` and everything inside it) is `aria-hidden` by design; the
  layered native select is the accessible control. Don't move interactive content into those parts
  via `::part` styling tricks, and don't expect the flag inside the open popup list — a native
  `<option>` is text-only.

---

## `lr-time-range`

A two-handle brush/scrubber over a numeric domain (no date logic — callers map their own time axis
onto `[min, max]`). Form-associated (`static formAssociated = true`, via `ElementInternals`): an
ancestor `<fieldset disabled>` disables both handles and every preset button through an internal
`effectiveDisabled` getter, the same way it would a native `<input>`, without ever mutating the
consumer-facing `disabled` property/attribute itself.

**Properties:**
- `min: number = 0`
- `max: number = 100`
- `start: number = 0`
- `end: number = 100`
- `step: number = 1`
- `disabled: boolean = false` (reflected)
- `startLabel: string = 'Range start'` (attribute `start-label`) — `aria-label` for the start handle
- `endLabel: string = 'Range end'` (attribute `end-label`) — `aria-label` for the end handle
- `presets: TimeRangePreset[] = []` (attribute: false) — `TimeRangePreset { label: string; start:
  number; end: number }`; optional discrete presets (e.g. "Last 7 days") rendered as a
  `[part="presets"]` button row above the track — purely additive, the continuous brush is
  unaffected and both interaction modes coexist; picking one sets both handles and emits the same
  `lr-input`/`lr-change` pair a committed drag or keyboard step would

**Events:** `lr-input` (fired continuously while dragging or on each arrow/Home/End/PageUp/
PageDown key press, `detail: { start, end }`), `lr-change` (fired on pointer release /
key-up-commit, or when a preset button is clicked, `detail: { start, end }`)

**Slots:** none.

**CSS parts:** `base`, `track`, `range`, `handle-start`, `handle-end`, `presets`, `preset-button`

**Themeable custom properties:** mostly shared tokens — `--lr-color-border`, `--lr-color-brand`,
`--lr-color-surface`, `--lr-shadow` (track/handles), `--lr-opacity-disabled` (`:host([disabled])`
dimming), plus (for `presets`) `--lr-color-text`, `--lr-color-on-brand` (the active preset
button's text), `--lr-radius`, `--lr-space-xs/-s`, `--lr-transition-fast`,
`--lr-focus-ring-*`.

Three component-local properties recolor the **active** preset button independently of the shared
palette: `--lr-time-range-preset-active-bg` (falls back to `--lr-color-brand`),
`--lr-time-range-preset-active-border-color` (falls back to `--lr-color-brand`), and
`--lr-time-range-preset-active-color` (falls back to `--lr-color-on-brand`). Unset, each resolves
to exactly the token the rule used before they existed, so the default rendering is unchanged.

They exist because the active preset is marked with an attribute on a part, and
`::part(preset-button)[data-active]` is **invalid CSS** — an attribute selector cannot follow
`::part()`. Without these, recoloring just the active preset meant hijacking the shared
`--lr-color-brand`/`--lr-color-on-brand` tokens and repainting everything else that reads them.

They are written as **inline `var()` fallbacks at the point of use, never declared on `:host`** —
deliberately, because a `:host` declaration would shadow any value an ancestor set. Setting one on
any ancestor of the `<lr-time-range>` therefore reaches it. (The same technique is used for
`lr-emoji-picker`'s `--lr-emoji-picker-active-bg`.)

**Optional peer deps:** none.

```html
<lr-time-range min="0" max="1440" start="480" end="1020" step="15"></lr-time-range>
<script>
  document.querySelector('lr-time-range')
    .addEventListener('lr-change', (e) => console.log(e.detail.start, e.detail.end));
</script>
```

**Known gotchas:**
- Keyboard support now matches the full WAI-ARIA APG slider pattern: ArrowUp/Right and ArrowDown/Left
  move by `step` (RTL-aware — under `direction: rtl` the forward/backward keys swap so they still
  track the visually-adjacent direction), PageUp/PageDown move by `step * 10`, and Home/End jump to
  that handle's actual *reachable* bound — clamped by the sibling handle's current value, not the
  component's full `[min, max]` domain, so Home/End on the `end` handle can't jump past `start` (and
  vice versa). Pointer-drag is RTL-aware the same way (mirrors the drag ratio under `direction:
  rtl`).
- A disabled handle now gets `aria-disabled="true"` in addition to losing `tabindex` — a
  screen-reader user exploring by virtual cursor no longer hears it announced as a live, adjustable
  slider.
- `aria-valuemin`/`aria-valuemax` on each handle report that handle's reachable sub-range (bounded by
  its sibling), not the full domain — matching what Home/End actually jump to.
- No `aria-valuetext`: only raw numeric `aria-valuenow` is exposed (omitted entirely, rather than a
  literal `"NaN"`, if `start`/`end` is non-finite), no hook for a human-readable (e.g. formatted
  date/time) equivalent of the mapped domain.
- Handles a `min > max` domain, a non-positive/non-finite `step`, and disabled-mid-drag/
  disconnect-mid-drag correctly (tested) — safe to rely on those edge cases. Concurrent drags are
  tracked per `pointerId` (not a single scalar), so a two-finger touch — one finger per handle —
  moves both independently instead of the second pointer hijacking which handle the first pointer's
  moves apply to; `pointercancel`/`lostpointercapture` (not just `pointerup`) both end a drag, same
  fix as `lr-split`.
- Non-finite domain/handle values use finite fallback geometry, and non-finite or negative steps are
  treated as unstepped; invalid values never become `NaN`/`Infinity` CSS or ARIA strings.
- `startLabel`/`endLabel` only override each handle's `aria-label`; they don't affect
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax` (still raw numbers) or any visible text.
- An ancestor `<fieldset disabled>` toggling is reflected via `formDisabledCallback` into
  `effectiveDisabled` (tracked separately from the consumer's own `disabled`), so re-enabling the
  fieldset correctly restores a handle that had `disabled` set explicitly by the consumer, and vice
  versa — mirrors `lr-combobox`'s identical pattern.

---

## `lr-swatch-picker`

A single-select picker over a small, fixed set of color swatches with the WAI-ARIA APG
`radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic
activation (click or arrow-key move both select immediately, like a native radio group), cyclic
Arrow/Home/End navigation. First-party invention (no Web Awesome equivalent). Distinct from
`lr-color-picker`'s freeform native color input — this picks exactly one of N designer-chosen
named colors, the shape apps otherwise hand-roll as a row of round accent-color buttons.

**Properties:**
- `options: SwatchOption[] = []` (attribute: false) — `SwatchOption { value: string; color: string;
  label: string; icon?: unknown }`; `color` is any CSS color string used as the swatch fill, `label`
  is each swatch's accessible name and `title`. `icon` is an optional custom shape (e.g. a gem
  glyph) rendered *instead of* the plain filled circle; the swatch sets `color: <option color>` so a
  `currentColor`-based SVG picks the option's color up automatically, matching
  `<lr-segmented>`'s `SegmentedItem.icon`.
- `value: string | null = null` — the currently selected option's `value` (controlled); `null`
  leaves nothing selected while keeping the first swatch tabbable.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — scales the swatch hit-area and
  fill diameter proportionally, hit-area floored at 24px; not pixel-matched to `lr-input`'s
  row-height scale)
- `label: string = ''` — accessible name copied to the internal `role="radiogroup"`; when empty, a
  host-level `aria-label` is used as a fallback.

**Events:** `lr-change` (`detail: { value }`) — fired only when the selected value actually
changes via click or keyboard (re-selecting the current swatch is a no-op).

**Slots:** none.

**CSS parts:** `base` (the `role="radiogroup"` root), `swatch` (a single `role="radio"` color
swatch's interactive hit target, sized via `--lr-swatch-picker-hit-size` — defaults to
`--lr-size-2-5rem`, swapped per `size` tier and floored at 24px; the selected one is
`[part='swatch'][aria-checked='true']`), `swatch-fill` (the filled circle inside it, sized via
`--lr-swatch-picker-fill-size` — defaults to `--lr-size-1-5rem`, also swapped per `size` tier —
rendered when the option has no `icon`), `swatch-icon` (the option's `icon` shape, rendered in its
place when it has one). Exactly one of `swatch-fill`/`swatch-icon` is mounted per swatch, so the
two never coexist.

**Themeable custom properties:** `--lr-swatch-picker-selected-color` (ring color around the
selected swatch, defaults to `--lr-color-brand`, themeable independently of the focus ring),
`--lr-swatch-picker-selected-blur` (default `0` — a crisp ring; set a real length such as `0.4rem`
for a soft glow. It is the blur radius of `swatch-fill`'s `box-shadow` ring, and of the equivalent
`drop-shadow()` used for `swatch-icon`, since `box-shadow` can't follow a slotted icon's real
shape), `--lr-swatch-picker-shine-duration` (default `0s`, a no-op; set a duration such as `1.6s`
for a looping brighten-and-settle pulse on the selected swatch. It drives a separate
`filter: brightness()` keyframe rather than `box-shadow`, so it composes with the blur token and
works identically for a fill and an icon; disabled outright under `prefers-reduced-motion: reduce`,
which also drops the hover/selection scale transition), `--lr-swatch-picker-hit-size` (hit-area
size, swapped per `size` tier), `--lr-swatch-picker-fill-size` (visible fill/icon diameter, swapped
per `size` tier); plus shared tokens — `--lr-color-border`/`-brand`, `--lr-space-xs`,
`--lr-border-width-thin`/`-thick`, `--lr-radius`, `--lr-transition-fast`, `--lr-focus-ring-*`,
and the per-tier `--lr-size-*` tokens.

**Optional peer deps:** none.

```html
<lr-swatch-picker label="Accent color"></lr-swatch-picker>
<script type="module">
  const picker = document.querySelector('lr-swatch-picker');
  picker.options = [
    { value: 'blue', color: '#0969da', label: 'Blue' },
    { value: 'green', color: '#1a7f37', label: 'Green' },
    { value: 'purple', color: '#8250df', label: 'Purple' },
  ];
  picker.value = 'green';
  picker.addEventListener('lr-change', (e) => console.log(e.detail.value));
</script>
```

**Known gotchas:**
- arrow-key navigation cycles (past the last swatch wraps to the first, and vice versa) rather than
  clamping, and self-selects on move — arrow-navigating to a swatch immediately updates `value` and
  fires `lr-change`, there's no separate commit step.
- under RTL (nearest `dir="rtl"` ancestor) `ArrowLeft`/`ArrowRight` swap which direction they move.
- each swatch's fill comes from its option's `color`, applied through a per-swatch custom property
  set inline on `[part='swatch']` and read by `[part='swatch-fill']`, so a consumer's
  `::part(swatch-fill)` `background-color` rule can still override it.
- style the selected state through `--lr-swatch-picker-selected-color`/`-selected-blur`/
  `-shine-duration`, not through `::part(swatch)[aria-checked='true']` from outside: the CSS Shadow
  Parts spec only allows a fixed set of pseudo-classes after `::part()`, not arbitrary attribute
  selectors, so that combinator can silently fail to match depending on the engine.
- the semantic `radiogroup` lives inside shadow DOM. Set `label` (preferred for reactive code) or a
  host `aria-label`; the component deliberately forwards the resulting name to that internal role.

---

## `lr-checkbox`

A boolean form control. `role="checkbox"` with an `aria-checked` that can also be `"mixed"`, and a
visual box/checkmark. Structurally the same idea as `<lr-switch>` (form-associated via
`ElementInternals`, click and Space toggle) but with checkbox semantics.

**Properties:**
- `checked: boolean = false` (reflected)
- `indeterminate: boolean = false` (reflected) — visual-only mixed state; does not affect `checked`,
  and is cleared back to `false` by any user interaction (click or keyboard), matching native
  `<input type="checkbox">`
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `name: string = ''`
- `value: string = 'on'` — only contributed to form submission while `checked` (a native checkbox
  submits nothing at all, not even an empty string, while unchecked)

**Events:** user toggles emit bubbling/composed `input`, then `change`, then the compatibility
`lr-change` alias (`detail: { checked: boolean }`). Programmatic `.checked` assignments are
silent. Internal `focus`/`blur` are re-dispatched as bubbling, composed host events.

**Methods:** `focus(options?)` and `blur()` forward to the internal checkbox control.

**Slots:** default — label text, rendered next to the box. Clicking it toggles the checkbox, the
same as clicking a native checkbox's associated `<label>`. If left empty, set `aria-label` on the
host so the control still has an accessible name.

**CSS parts:** `base` (the whole interactive control, `role="checkbox"`), `box` (the small square
showing the checkmark/indeterminate dash), `checkmark` (the checkmark or indeterminate-dash glyph),
`label` (wrapper around the default slot)

**Themeable custom properties:** `--lr-checkbox-label-indent` (below), plus shared tokens —
`--lr-space-s`, `--lr-icon-button-size`,
`--lr-color-border/-surface/-on-brand/-brand/-text/-danger`, `--lr-radius`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**`--lr-checkbox-label-indent`** — the inline distance from the control's start edge to the start of
the label text: the box's own floor plus the gap beside it. It defaults to
`calc(min(var(--lr-icon-button-size), 1.75rem) + var(--lr-space-s))`, and the rendered gap is
*derived* from it, so the advertised value and the real label offset cannot drift. Setting it on
the element (or on `lr-checkbox` in your own stylesheet) moves the label.

It is published so you can align your own per-option hint text under the label without re-deriving
that formula by reading the shadow styles. **But custom properties inherit down, not sideways**, so
a *sibling* node in your tree cannot read it off the checkbox. Align a sibling by computing the
same formula from the `--lr-theme-*` inputs you control:

```css
.checkbox-hint {
  padding-inline-start: calc(
    min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem) + var(--lr-theme-space-s, 0.5rem)
  );
}
```

`--lr-checkbox-checked-bg` (default `var(--lr-color-brand)`) and `--lr-checkbox-checked-border`
(default `var(--lr-color-brand)`) recolor `[part='box']`'s background/border while `checked` or
`indeterminate` — a component-scoped indirection (the same pattern `lr-source-picker`'s own
`--lr-source-picker-checked-bg`/`-border` pair uses) so a consumer can retint just this control's
checked/indeterminate fill without hijacking the shared `--lr-color-brand` token everything else
reads.

**Optional peer deps:** none.

```html
<lr-checkbox name="terms" required>Accept the terms and conditions</lr-checkbox>
<script type="module">
  document
    .querySelector('lr-checkbox')
    .addEventListener('lr-change', (e) => console.log(e.detail.checked));
</script>
```

Form-associated via a directly-attached `ElementInternals` (not the shared `FormAssociated` mixin,
whose `value` accessor assumes a plain string default flow) with its own hand-rolled
`updateValidity()` — same shape as `<lr-combobox>`'s and `<lr-switch>`'s direct-`ElementInternals`
handling.
Session-history/autofill restoration uses four explicit state tokens: `checked`, `unchecked`,
`checked/indeterminate`, and `unchecked/indeterminate`. This preserves both public booleans while
keeping an unchecked control distinguishable from a checked control whose submitted value is an
empty string. Restoration updates state, form data, and validity synchronously without firing
`lr-change`.

**Known gotchas:**
- `formResetCallback()` restores `checked` to whatever the declarative `checked` attribute parsed to
  at first connect — captured once via a one-shot flag (not from `attributeChangedCallback` alone,
  since `checked` reflects and that would wrongly re-capture on every later user toggle). A later
  `el.checked = true` assignment never redefines the reset default.
- `indeterminate` is visual-only and silently clears on any user click/keypress — a consumer relying
  on it staying `true` after a user interacts with the box will be surprised.
- The rendered `aria-label` is copied from the host's own `aria-label` attribute at render time; if
  neither that nor slotted label text is present, the control has no accessible name.

---

## `lr-switch`

A boolean toggle-switch form control. `role="switch"` with `aria-checked` read as an on/off state
rather than checked/unchecked, and no indeterminate state. Structurally the same idea as
`<lr-checkbox>` (form-associated via `ElementInternals`, click and Space/Enter both toggle).
Ships an opt-in `hint`/`errorText` form-control chrome (props + matching named slots + `hint`/`error`
CSS parts), mirroring `<lr-select>`'s pattern for those two pieces — left unset, neither renders.
Deliberately no separate top-of-field `label` prop/slot/part: the default slot already is this
control's visible, clickable label (same as `<lr-checkbox>`).

**Properties:**
- `checked: boolean = false` (reflected)
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `name: string = ''`
- `value: string = 'on'` — only contributed to form submission while `checked`
- `hint: string = ''` — hint text below the switch. Unset: no hint chrome renders.
- `errorText: string = ''` (attribute `error-text`) — error text below the switch (overridden by
  slotted `error` content). Unset: no error chrome renders.

**Events:** `lr-change` (`detail: { checked: boolean }`) — fired on a user toggle (click or
Space/Enter); not fired for a programmatic `.checked` assignment.

**Methods:** `focus(options?)` and `blur()` forward to the internal switch control.

**Slots:**
- default — label text, rendered next to the track. Clicking it toggles the switch, the same as
  clicking a checkbox's associated `<label>`. If left empty, set `aria-label` on the host so the
  control still has an accessible name.
- `hint` — custom hint content.
- `error` — custom error content.

**CSS parts:** `form-control` (the outer wrapper around the switch, error and hint), `base` (the
whole interactive control, `role="switch"`), `track` (the pill-shaped background), `thumb` (the
circular knob that slides across the track), `label` (wrapper around the default slot), `hint` (the
hint message), `error` (the error message)

**Themeable custom properties:** `--lr-switch-track-inline-size` (default `2.25rem`),
`--lr-switch-track-block-size` (default `1.25rem`), `--lr-switch-thumb-offset` (default
`2px`) — component-local geometry knobs, set on `:host`, since a fully-rounded pill/thumb needs
a radius well past the shared `--lr-radius` default — plus shared tokens
`--lr-space-s`, `--lr-color-border/-brand/-surface/-text`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-switch name="notifications" checked>Enable notifications</lr-switch>
<script type="module">
  document
    .querySelector('lr-switch')
    .addEventListener('lr-change', (e) => console.log(e.detail.checked));
</script>
```

Form-associated the same way as `<lr-checkbox>`: a directly-attached `ElementInternals` with a
hand-rolled `updateValidity()`, not the shared `FormAssociated` mixin. The thumb animates the
logical `inset-inline-start` property (not a physical `transform: translateX()`), so the slide
direction mirrors correctly under `dir="rtl"`.
Session-history/autofill restoration uses the same explicit `checked`/`unchecked` state tokens as
checkbox and does not emit `lr-change`.

**Known gotchas:**
- `formResetCallback()` restores `checked` to the value captured from the declarative `checked`
  attribute at first connect (same one-shot-flag capture as `<lr-checkbox>`) — a later `.checked =
  true` property assignment never redefines what `form.reset()` restores to.
- The rendered `aria-label` is copied from the host's own `aria-label` attribute at render time; with
  neither that nor slotted label text, the control has no accessible name.

---

## `lr-slider`

A numeric range control (e.g. an LLM "temperature" setting). **Form-associated** via the shared
`FormAssociated` mixin (`name`, `value`, `disabled`, `required` all inherited). Mirrors native `<input
type="range">` semantics: `value` is the string form-submitted via the mixin, `valueAsNumber` is the
ergonomic numeric accessor (matching native `<input type=range>`'s IDL attribute of the same name) kept
in sync with it in both directions. Clicking anywhere on `[part="base"]` (not just the thumb) jumps the
thumb to that point and continues the same gesture as a drag, matching native `<input type=range>`
click-to-seek — the thumb is also `.focus()`ed on that click, so keyboard interaction can continue
seamlessly right after. First-party invention (no Web Awesome equivalent).

**Properties:**
- `min: number = 0`
- `max: number = 100`
- `step: number = 1`
- `label: string = ''` — accessible name set as `aria-label` on the `role="slider"` thumb; a plain
  `aria-label` attribute on the host itself is honored as a fallback when this is left unset (matching
  `<lr-checkbox>`/`<lr-switch>`).
- `showValue: boolean = true` (attribute `show-value`) — whether to render the current numeric value as
  visible text next to the track. Not reflected; toggle it off via the `.showValue=${false}` property
  binding — a bare `show-value="false"` content attribute is still truthy, since presence is all Lit's
  default boolean converter checks.
- Inherited from `FormAssociated`: `name: string = ''`, `value: string` (form-submitted string form),
  `disabled: boolean = false` (reflected), `required: boolean = false` (reflected).

**Accessor:** `valueAsNumber: number` — get/set. Reading always returns a finite, clamped, step-snapped
number, even if `value` is momentarily `""` (e.g. right after `form.reset()`, before the mount-time
default reseeds it), by falling back to the midpoint of `[min, max]`. Writing clamps/snaps the input and
stringifies the result back into `value`.

**Events:** `lr-input` (`detail: { value: number }` — fired continuously during an active drag or a
keyboard step, including OS key-repeat while a key is held, mirroring native `<input type=range>`'s
`input` event), `lr-change` (`detail: { value: number }` — fired once an interaction commits: on
pointerup for a drag, or on keyup for a keyboard step, so a single Arrow/Home/End/PageUp/PageDown press
fires both `lr-input` and `lr-change`, mirroring native `<input type=range>`'s own `change`-on-every-
committed-step behavior)

**Slots:** none.

**CSS parts:** `base` (row wrapping the track and optional value readout), `track`, `fill` (filled
portion from `min` up to the current value), `thumb` (`role="slider"`), `value` (numeric readout, shown
when `show-value` is true)

**Themeable custom properties:** shared tokens only — `--lr-space-s`,
`--lr-color-border/-brand/-surface/-text-quiet`, `--lr-shadow`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-slider
  name="temperature"
  min="0"
  max="2"
  step="0.1"
  label="Temperature"
  .valueAsNumber=${0.7}
  @lr-input=${(e) => setDraftTemperature(e.detail.value)}
  @lr-change=${(e) => commitTemperature(e.detail.value)}
></lr-slider>
```

An unset `value` is eagerly defaulted — on connect, and again after `form.reset()` — to the midpoint of
`[min, max]` snapped to `step`, the same "range sanitization algorithm" default a native range input
applies. A slider therefore always represents *some* number, so `required` only has a narrow window to
block submission before that default lands, matching how `required` isn't a meaningful constraint on a
native range input either.

**Known gotchas:**
- `valueAsNumber` always returns a real, clamped number — never `NaN` or `""` — even reading it in the
  brief window right after a `form.reset()`.
- Under `direction: rtl`, physical ArrowRight/ArrowLeft swap which one counts as "forward" (increasing
  value); ArrowUp/ArrowDown are never swapped, since direction only affects the horizontal inline axis.
- Changing `min`/`max`/`step` after mount automatically re-clamps/re-snaps the current `value` in the
  next update — narrowing the domain can silently move the slider's value.
- A pointer drag fires `lr-input` continuously and a single `lr-change` on release; a keyboard step
  fires exactly one of each per press, but OS key-repeat while a key is held re-fires `lr-input` on
  every repeat while still only committing `lr-change` once, on the eventual keyup.

---

## `lr-radio`

A form-associated single-choice control. Use it alone or inside `lr-radio-group`.

**Properties:** `checked`, `disabled`, `required`, `name`, and `value` (all reflected where
applicable). A selected radio submits its value through `ElementInternals`.
`effectiveRequired` exposes the required state inherited from a containing radio group. `focus()`,
`blur()`, and `click()` forward to the internal radio control.

**Events:** native-style composed `input` and `change`, plus `lr-change` with
`{ checked, value }`.

**Slots:** default label content.

**CSS parts:** `base`, `circle`, `dot`, `label`.

**Themeable custom properties:** `--lr-radio-label-indent` — the inline distance from the control's
start edge to the start of the label text, i.e. the circle's own floor plus the gap beside it,
defaulting to `calc(min(var(--lr-icon-button-size), 1.75rem) + var(--lr-space-s))`. The rendered
gap is derived from it, so the advertised value and the real offset cannot drift; setting it on the
element (or on `lr-radio` in your own stylesheet) moves the label. Exactly the same knob, defaults,
purpose, and sideways-inheritance caveat as `--lr-checkbox-label-indent` — see `lr-checkbox` above
for the formula to align a sibling hint element.

```html
<lr-radio name="format" value="json">JSON</lr-radio>
```

## `lr-radio-group`

A labeled, keyboard-navigable group of `lr-radio` controls. Arrow keys, Home, and End move
focus; arrow navigation selects the next enabled radio.

**Properties:** `label`, `hint`, `errorText` (`error-text`), `name`, `required`, `disabled`, and
`aria-label` (through `accessibleLabel`).

**Events:** `lr-change` with `{ value, radio }`.

**Slots:** default radios, `label`, `hint`, `error`.

**CSS parts:** `base`, `label`, `hint`, `error`.

## `lr-checkbox-group`

A form-associated collection of `<lr-checkbox>` children. Its `value` is a `string[]`; each
selected value is submitted under `name` and `required` requires at least one selection.

**Properties:** `label`, `hint`, `errorText`, `value`, `name`, `required`, `disabled`, and
`accessibleLabel` (`aria-label`). **Slots:** default checkboxes, `label`, `hint`, `error`.
**Events:** `input`, `change`, and `lr-change` with `{ value: string[] }`.
**CSS parts:** `form-control`, `form-control-label`, `options`, `hint`, `error`.

**`value` is a read-out of child state, not an input.** The children are the single source of
truth. An internal sync recomputes `value` from them and reassigns it on every child toggle,
`slotchange`, `name`/`required` change, blur, and `form.reset()` — so a host assignment is
silently overwritten by the next of those. `connectedCallback()` runs that sync **before the first
render**, which means even a constructor-time or template-time `.value=${…}` binding is discarded
before anything can observe it. Assigning `value` logs a `console.warn` naming the property (once
per group instance).

- **To preselect**, set `checked` on the children: `<lr-checkbox value="a" checked>`.
- **To read the selection**, use this property or the `lr-change` event detail.
- **Give every child a distinct `value`.** `<lr-checkbox>`'s `value` defaults to `'on'`, so a group
  of undifferentiated children submits several identical `FormData` entries and the submitted data
  cannot say which one was checked. The group warns once per duplicated value when it sees this.
- Making `value` authoritative is deliberately not implemented, for the same reason: a host
  assigning `['on']` would check every child that kept the default. A distinct `defaultValue` API
  could be added later without reversing any of the above.

## `lr-token-input`

An editable form-associated token list. Enter, comma, or blur commits a token; Backspace removes
the last token. `value` is a `string[]` and repeated values are submitted under `name`.

**Properties:** `value`, `label`, `hint`, `errorText` (`error-text`), `placeholder`, `name`,
`required`, `disabled`, `accessibleLabel` (attribute `aria-label` — forwarded to the internal text
input), `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — same scale as `lr-input`'s
`size`, scaling the input-wrapper's row height and text size across six tiers; the remove button's
hit area stays fixed at `40px` across all sizes), `allowDuplicates` (`allow-duplicates`, default
`false`), `editable` (reflected, default `false` — see below), and `delimiter: string | null` (default
`','` — see below).
**Slots:** `label`, `hint`, `error`.
**Events:** `input`, `change`, `lr-add` (`detail: { value }`), `lr-remove`
(`detail: { value, index }`), and `lr-token-edit`
(`detail: { value, previousValue, index }` — an existing token was edited in place and committed).
**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `token`, `token-label` (the
token's text, doubling as the roving-focus edit trigger — rendered only while `editable`),
`token-editor` (the inline text field that replaces a token's text while it is open for editing —
rendered only while `editable` and only for the token being edited), `remove` (the
per-token remove button, floored at the shared `--lr-icon-button-size` tap size around a compact
glyph), `input`, `hint`, `error`. `focus()` and `blur()` forward to the internal text input.

**`editable` — editing a token in place.** Off by default, in which case the token row renders
exactly as it does without the feature and stays non-focusable. Turn it on and each token becomes a
roving tab stop (one Tab stop for the whole row): click, Enter, Space, or F2 opens an inline
editor on that token; ArrowLeft/ArrowRight move between tokens (swapped under RTL, since they mean
previous/next *visually*), Home/End jump to the first/last. Inside the editor, Enter commits and
returns focus to the token, Escape cancels (and is consumed rather than left to bubble, so an
enclosing dialog or popover does not also close), and blurring commits *without* pulling focus
back — a blur means the user already aimed focus elsewhere. `lr-token-edit` fires only for an edit
that actually changed something: a reverted, unchanged, emptied, or (under the default
`allowDuplicates = false`) duplicate-colliding edit is discarded silently, mirroring how a
duplicate draft is skipped rather than rejecting the whole entry.

**`delimiter` is nullable, and only a single character acts as a commit key.** It does two separate
jobs: it splits a committed draft into several tokens, and — *only when it is exactly one
character* — it is the keystroke that commits the draft. A multi-character delimiter still splits a
pasted or committed draft, but no keystroke can ever match it, so nothing commits on typing.
Setting it to `null` disables both, so a token may contain the delimiter verbatim. **`delimiter="null"`
does not work** — that is the four-character string `null`. Use `delimiter="none"`, `delimiter=""`
(both of which the attribute converter maps to `null`), or a property binding
(`.delimiter=${null}`). Removing the attribute restores the `,` default.

**Themeable custom properties:** `--lr-token-input-padding` (the input-wrapper padding, scaled by
`size`), `--lr-token-input-font-size` (the input-wrapper and token font size, scaled by `size`),
`--lr-token-input-control-min-height` (the input-wrapper's block-size floor, scaled by `size`),
`--lr-token-input-control-height` (exact input-wrapper height — undeclared by default, leaving the
`--lr-token-input-control-min-height` floor only; set it to a length to both floor and cap the row,
e.g. to pixel-match a sibling field in the same toolbar row), `--lr-token-input-input-inline-size`
(the editable input's `flex-basis` inside the wrapped token row; undeclared by default, falling back
inline to `--lr-size-8rem`), `--lr-token-input-min-input-inline-size` (default `--lr-size-4rem`, the
floor that input keeps once tokens have consumed the row), and `--lr-token-input-editor-inline-size`
(default `--lr-size-6rem`, the inline size of the inline token editor opened by `editable`).

## `lr-code-editor`

Dependency-free, form-associated multiline code editor built around a native textarea, with an
optional line-number gutter. No syntax highlighting: `language` is metadata only.

**Properties:**
- `language: string = ''` — reflected onto the `editor` part as `data-language`; purely a styling/
  metadata hook, nothing tokenizes the text
- `lineNumbers: boolean = true` (attribute `line-numbers`, reflected) — renders the `gutter` part,
  one row per `\n`-separated line
- `tabSize: number = 2` (attribute `tab-size`) — spaces inserted per Tab press, and the textarea's
  inline `tab-size`. Sanitized on assignment to a finite integer clamped to `1..16`, so a
  `NaN`/`Infinity` value can neither empty the insert nor throw out of `String.repeat()`
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`),
  `placeholder: string = ''`
- `readonly: boolean = false` (reflected) — also disables Tab indentation
- `resize: 'none' | 'both' | 'horizontal' | 'vertical' = 'both'` — written as the textarea's inline
  `resize`
- `wrap: 'off' | 'soft' | 'hard' = 'off'` — native textarea wrapping; `'off'` (the default) makes
  the `editor` part the single horizontal scroll viewport
- `spellcheck: boolean = false` — off by default for code, and parsed with a string-aware converter
  so `spellcheck="false"` really is `false`
- `autocapitalize: string = 'off'`, `autoCorrect: string = 'off'` (attribute `autocorrect`)
- `accessibleLabel: string = ''` (attribute `aria-label`) — wins over `label`/the localized
  `codeEditorLabel` fallback on the internal textarea

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange(start, end, direction?)`,
`setRangeText(replacement, start?, end?, selectMode?)` (writes the result back into `value` without
emitting an event), plus the `selectionStart`/`selectionEnd` getters (both `0` before first render).

**Events:** `input` and `change` — Lyra-emitted, bubbling/composed, each with `detail: { value }`
(so they carry a detail a native `input`/`change` would not); also `focus`/`blur`, re-dispatched
bubbling and composed from the internal textarea.

**Slots:** `label`, `hint`, `error`.

**CSS parts:** `form-control`, `label` (**not** `form-control-label` as on the other form
components), `editor` (the bordered frame and the single scroll viewport), `gutter` (line numbers,
`aria-hidden`, only when `lineNumbers`), `textarea`, `hint`, `error`.

**Themeable custom properties:** `--lr-code-editor-min-block-size` (default `--lr-size-8rem`, the
frame's and textarea's height floor) and `--lr-code-editor-line-height` (default `1.5`, applied to
both gutter and textarea so line numbers stay aligned with their lines).
`--lr-code-editor-tab-size` (default `2`) is read by the `textarea` part's rule and drives both the
rendered tab stops and the number of spaces Tab inserts. Precedence, highest first: an explicitly
assigned `tabSize` (property or `tab-size` attribute) > a host-level `--lr-code-editor-tab-size` >
the `:host` default of `2`. The component writes the token inline on the `textarea` part only while
`tabSize` has been assigned, so an untouched `tabSize` leaves your override in charge; removing the
`tab-size` attribute hands control back to the token. A length-valued override (`40px`, `2ch`, …)
still sets the visual tab stops for literal tab characters, but is not reinterpreted as a count of
spaces — the Tab key keeps inserting `tabSize` spaces in that case.

**Known gotchas:**
- Keyboard contract (no keyboard trap, WCAG 2.1.2): Tab inserts one indent unit of spaces at the
  caret (see the tab-width precedence above);
  Shift+Tab is never captured, so reverse focus traversal always works; pressing Escape releases
  the *next* Tab for forward traversal instead, and any other keypress (or focus leaving the
  editor) re-arms Tab indentation.
- The host gets a `data-invalid` attribute once the field has been blurred at least once and
  validity fails; the styles hang the danger border off it.

## `lr-color-picker`

A form-associated native color picker with label, hint, and error chrome. **Properties:** the shared
form properties `name`, `value`, `disabled`, and `required`, plus `label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), and `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'`
(reflected — same scale as `lr-input`'s `size`, for compact swatch rendering at every density tier).
**Slots:** `label`, `hint`, `error`. **Events:**
composed `input` and `change`, `lr-change` with `{ value }`, and `focus`/`blur` (re-dispatched from
the internal `<input>`'s own `focus`/`blur`, bubbling and composed unlike the native events). **CSS
parts:** `form-control`, `form-control-label` (the label; `label` is an alias kept for back-compat),
`input`, `hint`, `error`.

**Themeable custom properties:** `--lr-color-picker-swatch-size` — the swatch's inline and block size,
auto-swapped per `size` tier (default `'m'` reads `2.5rem`, `'2xs'` reads `1.25rem`, etc.), matching
the size ladder `lr-input` uses.

## `lr-emoji-picker`

A searchable, keyboard-navigable, form-associated emoji picker. `groups` is fully consumer-suppliable
— the component ships no emoji data of its own — in the same "zero/optional-peer dependency" spirit
as `<lr-lite-chart>`/`<lr-heatmap>`; an optional convenience auto-loader fetches a default set on
connect from the `emoji-picker-element-data` peer, but only when `groups` hasn't already been
supplied (an explicit empty array still counts as supplied and skips the auto-load).
When the filtered set reaches 200 items, the grid automatically windows its visible rows while
preserving the full option count through `aria-setsize`/`aria-posinset`.

Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `lr-select`/
`lr-color-picker` (props + matching named slots + `form-control`/`form-control-label`/`hint`/
`error` CSS parts) — left unset, none of that chrome renders.

**Properties:** the shared form properties `name`, `value`, `disabled`, and `required`, plus
`groups: EmojiPickerGroup[] = []` (attribute: false) — `EmojiPickerGroup { key, label, emojis:
EmojiPickerItem[] }`, `EmojiPickerItem { emoji, name, shortcodes? }`; the search field matches `name`
and every `shortcodes` entry, case-insensitively. Empty (the default, before the auto-loader
resolves) renders just the search input and the empty state. `accessibleLabel` (`aria-label`)
forwards a host-supplied accessible name to the internal `role="listbox"` grid; empty falls back to
the localized default grid label. `label: string = ''` — visible label rendered above the
search/grid; unset renders no label chrome. When `label` (or the `label` slot) is set and
`accessibleLabel`/a host `aria-label` is not, the grid's accessible name switches from the
localized default to `aria-labelledby` pointing at the visible label. `hint: string = ''` —
supporting text rendered below the search/grid; unset renders no hint chrome. `errorText: string =
''` (attribute `error-text`) — validation-error text rendered below the hint (overridden by slotted
`error` content when provided); unset renders no error chrome. `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` —
visual size; scales the emoji grid item box and its glyph proportionally, floored at 24px (WCAG 2.5.8).

**Events:** `lr-change` with `detail: { emoji }` (an emoji was picked — click, or Enter/Space on
the active grid cell; also sets `value`), plus the shared form `input`, `change`, `focus`, and `blur`.

**Keyboard:** the grid is a roving-tabindex listbox (a single Tab stop — only the active emoji is
tabbable). ArrowLeft/ArrowRight step the active item backward/forward following reading direction
(swapped under RTL), ArrowUp/ArrowDown move by one visual row (measured from the live wrap layout),
Home/End jump to the first/last item, and Enter/Space picks the active item. The search input is a
`role="combobox"` over the same listbox: the arrow keys and Enter also work while focus stays in
the input, with `aria-activedescendant` tracking the active option. Hovering an emoji with the
pointer also moves the active item to it.

**Slots:** `label` (custom label content), `hint` (custom hint content), `error` (custom error
content, overrides the `errorText` attribute when provided).

**CSS parts:** `form-control` (the outer wrapper around label, `base`, error and hint),
`form-control-label` (the visible label), `base`, `search` (`role="combobox"`), `grid`
(`role="listbox"`, the scroll viewport), `group-label`, `emoji` (each emoji's own `role="option"`
button), `empty` (shown when the search matches nothing), `hint` (the hint message), `error` (the
error message). While windowing is active the rows are wrapped in `virtual-spacer`
(full-height scroll spacer), `virtual-row` (one absolutely-positioned row), `virtual-label` (an
`aria-hidden` spacer standing in for a row's missing `group-label`), and `virtual-items` (the row's
emoji flex line).

**Themeable custom properties:** `--lr-emoji-picker-item-size` (default `--lr-icon-button-size`,
each emoji button's box; scaled by the `size` property), `--lr-emoji-picker-glyph-size` (default
`--lr-font-size-lg`, the font size of the emoji glyph; scaled by the `size` property to keep the glyph
proportional to the item box), `--lr-emoji-picker-gap` (default `--lr-space-2xs`, the gap between
emoji within a windowed row), and `--lr-emoji-picker-row-height` (default
`calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l))`, one windowed row's height). The first three
are also read back in JS to derive columns-per-row and row offsets for the windowed layout,
resolved to real pixels by measuring hidden probe boxes the component's own stylesheet sizes from
those same tokens — so any CSS length unit works, `rem`/`em` and `calc()` included, and the windowed
geometry matches what is painted without expressing the tokens in `px`. The measurement is cached
and re-derived only when the resolved pixels can actually change (a token override applied after the
first render, a theme swap, a root or host font-size change feeding a `rem`/`em` value), never per
frame.

`--lr-emoji-picker-active-bg` recolors the highlight behind the active/hovered emoji, falling back
to `--lr-color-brand-quiet` when unset — so the default rendering is unchanged. Hover and
keyboard-active deliberately share one declaration, so this single hook retints both consistently.
It exists because `::part(emoji)[data-active]` is **invalid CSS** (an attribute selector cannot
follow `::part()`), which previously left hijacking the shared `--lr-color-brand-quiet` token — and
repainting everything else that reads it — as the only way in. Like `lr-time-range`'s preset
properties, it is written as an inline `var()` fallback at the point of use rather than declared on
`:host`, so a value set on **any ancestor** reaches it instead of being shadowed.

Two constraints remain. `--lr-emoji-picker-item-size` is held at a flat 24px minimum (WCAG 2.5.8
touch target floor): the smaller `size` tier values can shrink the box below the old 40px
unconditional floor, but the minimum holds at 24px regardless of tokens, and the windowed geometry
follows the clamped, painted size. And windowed rows are absolutely positioned at the row-height
pitch, so `--lr-emoji-picker-row-height` must stay at or above the item size plus the group-label
band (`--lr-space-l`) — the default's own formula — or consecutive rows overlap. Columns per
windowed row are additionally capped at 20 regardless of available width.

**Optional peer dependency:** install `emoji-picker-element-data` with
`pnpm add emoji-picker-element-data` for the built-in auto-loaded default emoji set — omit it and
supply `groups` directly instead. The loader never throws; a missing or failed peer logs one
`console.warn` and simply leaves `groups` empty.

## `lr-rubric-form`

A configurable annotation rubric (LangSmith annotation-queue style): score, category, and
freeform-comment keys with a submit-and-next flow for working through an eval queue. Each
`RubricKey.type` routes to an existing sibling control: `score` renders `<lr-segmented>` or
`<lr-slider>`; `category` renders `<lr-select>` or `<lr-checkbox-group>` (`multiple`); `comment`
renders `<lr-textarea>`.

**Properties:** `keys: RubricKey[] = []` (attribute: false, each `{ key, type, label?, description?,
required?, min?, max?, step? }`), `value: RubricValue = {}` (attribute: false), `itemId: string = ''`
(attribute `item-id`, reflected), `hasNext: boolean = false` (attribute `has-next`), `skippable:
boolean = false`, and the shared form properties `name` and `disabled`. `errors: Record<string,
string>` is the current per-key validation-message state.

**Slots:** `actions` — extra host controls rendered in the footer beside Submit/Skip.

**Events:** `lr-input` (`detail: { value }`), `lr-validity-change` (`detail: { valid, errors }`,
fired only on an actual change), `lr-submit` (`detail: { value, itemId }`), and `lr-skip`
(`detail: { itemId }`, `skippable` only).

**CSS parts:** `base` (the outer wrapper), `field` (one key's wrapper), `label`, `description`,
`scale` (the rendered score/category/comment control's wrapper), `error` (a field-level validation
message), `footer`, `submit`, `skip` (only rendered when `skippable`), `empty` (shown when `keys` has
no entries), and `unsupported` (the fallback note for a key whose `type` is outside the three
supported ones).

**Themeable custom properties:** shared tokens only. The footer's disabled `submit`/`skip` buttons
dim through `--lr-opacity-disabled`, the same library-wide token every other disabled control
reads — so retuning `--lr-theme-opacity-disabled` keeps this form's disabled state consistent with
the rest of the UI instead of needing a `::part()` rule here.

## `lr-locale-picker`

A closed-list locale switcher over the library's own locale registry. First-party invention (no
Web Awesome equivalent). With `locales` unset (the default), the offered rows are exactly
`getRegisteredLyraLocales()` — every locale with strings registered via `registerLyraLocale()`,
plus `en` — kept live via `subscribeLyraLocaleRegistry()`. Built directly on `lr-select`'s
trigger-button/`aria-activedescendant` listbox technique, not composed from it — a plain closed
list, no filter/free-text mode.

**Properties:**
- `locales: LyraLocaleCatalog = []` (attribute: false) — `LyraLocaleCatalog = string[] |
  LyraLocaleEntry[]`, `LyraLocaleEntry { tag: string; label?: string }`. Empty (the default)
  auto-discovers the registry; a non-empty array (either form) overrides it entirely — a curated
  subset, custom order, custom labels, or a locale offered before its strings are registered.
- `showFlags: boolean = true` — each row's leading `<lr-flag language={tag} variant="compact">`;
  `false` omits the flag element entirely (not just visually).
- `value: string = ''` — the **committed** selection (form value, drives `lr-change`). While `''`
  and untouched, the trigger *displays* `effectiveLocale` as a preview label, but
  `checkValidity()`/`required` are governed by the real `value`, which stays `''` until a real
  commit — mirrors a native `<select>` showing its first option's text without that being a
  committed selection.
- `required: boolean = false`, `disabled: boolean = false`, `name: string = ''` — standard
  form-associated properties.
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`) —
  same opt-in form-control chrome as `lr-select` (props + matching named slots + parts); unset
  renders none of it.
- `open: boolean = false` (reflected).
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — same scale as `lr-select`'s `size`).

**Events:** `lr-change` (`detail: { value, previousValue }`, **cancelable**) — fired on every
explicit pick; if not `defaultPrevented`, the component applies the pick itself via
`setLyraLocale(value)`. A listener calling `event.preventDefault()` leaves `value` updated but the
active locale untouched, so a host can persist the choice first and apply it later. `blur`/`focus`
re-dispatched from the internal trigger as bubbling, composed events.

**Methods:** `focus(options?)`, `blur()`, and `click()` — all forward to the internal trigger
button, same convention as `lr-select`'s identical trio.

**Slots:** `label`, `hint`, `error`.

**CSS parts:** `form-control`, `form-control-label`, `trigger`, `listbox`, `option`,
`option-flag` (present only while `showFlags` is on), `option-label`, `option-tag` (the row's
secondary line — the raw BCP-47 tag), `expand-icon`, `hint`, `error`.

**Themeable custom properties:** `--lr-locale-picker-trigger-padding`,
`--lr-locale-picker-trigger-min-height`, `--lr-locale-picker-trigger-height` (unset by default, a
floor-only escape hatch — set a length to both floor and cap the trigger),
`--lr-locale-picker-font-size`, `--lr-locale-picker-expand-size` (all scaled by `size`), and
`--lr-locale-picker-option-active-bg` (default `--lr-color-brand-quiet`, the hovered/keyboard-active
row background).

**Optional peer deps:** none directly — each row's `<lr-flag>` degrades to an empty render (no
peer warning duplication; `lr-flag` itself already logs one) when the optional
`@aceshooting/lyra-flags` package isn't installed and `showFlags` is left on.

```html
<lr-locale-picker label="Language"></lr-locale-picker>
<script type="module">
  import { registerLyraLocale } from '@aceshooting/lyra-ui';
  registerLyraLocale('fr', { close: 'Fermer' });
  document
    .querySelector('lr-locale-picker')
    .addEventListener('lr-change', (e) => console.log(e.detail.value));
</script>
```

**Known gotchas:**
- selecting a row applies `setLyraLocale()` itself unless the listener calls
  `event.preventDefault()` on `lr-change` — it does not touch
  `document.documentElement.lang`/`dir`; apply writing-direction changes to the page yourself.
- no filter/free-text mode — for a catalog with hundreds+ of rows, roll your own with `lr-select`
  or `lr-combobox` instead.
- arrow-key navigation is vertical-only (Home/End/ArrowUp/ArrowDown); there is no
  ArrowLeft/ArrowRight remap under RTL, since there is no horizontal axis to remap.
