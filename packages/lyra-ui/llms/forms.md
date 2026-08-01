## `lr-combobox` / `lr-option`

Filterable single/multi-select combining a text input with a listbox. Mirrors the core
`<wa-combobox>` API under the `lr-` prefix. **Form-associated** (hand-rolled internals, not the
shared `FormAssociated` mixin — see gotchas).

### `lr-combobox`

**Properties:**
- `multiple: boolean = false` (reflected)
- `size: LyraSize = 'm'` (reflected — the shared control ladder, so both `2xs`/`xs`/`s`/`m`/`l`/`xl`
  and the `small`/`medium`/`large` spellings are accepted; also scales the "+N" overflow tag and
  decorative expand icon; `size="s"` shares its outer control height with `lr-input`, `lr-select`,
  and `lr-segmented` without part overrides)
- `pill: boolean = false` (reflected) — rounds the trigger row's corners to a full pill, mirroring
  `lr-input`'s own `pill`. It only re-assigns `--lr-combobox-radius` to `--lr-radius-pill`, so a
  consumer setting that property directly still wins for a bespoke shape
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
- `withClear: boolean = false` (attribute `with-clear`) — Web Awesome's spelling of `clearable`;
  either one enables the same clear button. Not deprecated: Web Awesome names this attribute
  `with-clear` and Shoelace names it `clearable`, so honouring both is what keeps a mechanical tag
  rename from silently dropping the control
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
- `source: ComboboxSource | null = null` (attribute: false — `(query: string, options: { signal:
  AbortSignal }) => Promise<ComboboxSourceRow[]>`; when set, replaces the light-DOM `<lr-option>`
  list with an async lookup, debounced by `sourceDelay` ms after each keystroke and re-run on
  clear/pick. Forward `options.signal` to `fetch(url, { signal })` to cancel the request when a
  newer query supersedes it or the element disconnects. `loadingText` is shown while a call is in
  flight; a stale in-flight call that resolves after a newer one (or after disconnect) is dropped
  via a monotonic token. The exported type requires the `options` parameter; an existing
  one-parameter `(query) => …` function remains assignable under TypeScript's ordinary function
  parameter compatibility, but consumers that need cancellation should accept and forward
  `options.signal`.)
- `sourceDelay: number = 200` (attribute `source-delay` — debounce in ms between the last keystroke
  and the `source` call; `0` fires on every keystroke. Sanitized to a finite non-negative duration,
  falling back to `200` for a non-finite value)
- `maxRender: number = 200` (attribute `max-render` — caps how many rows render at once, always
  keeping the current selection visible even if it's outside the cap; the excess renders as one
  `overflowText` row instead of being dropped silently. See "Large option lists" below for how to
  size it, and when `source` is the better answer)
- `value: string | string[]` — a getter/setter: plain `string` in single mode, `string[]` in
  `multiple` mode
- `selectedRows: ComboboxSourceRow[]` (read-only getter) — structured rows for the current
  selection, including any opaque `data` payload supplied by an async source. Selected async rows
  remain available after the query changes or a later source result no longer contains them
- `selectionStart`, `selectionEnd`, and `selectionDirection` — selection getters/setters forwarded
  to the internal input

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and `setRangeText()`
forward to the internal input. `setRangeText()` synchronizes the filter query and visible options.
`setCustomValidity(message)` carries a rejection no client-side constraint can express ("that option
is no longer available"): a non-empty message raises `customError`, becomes `validationMessage`, and
blocks submission; `''` clears it and restores the control's own computed validity, so a `required`
combobox with nothing chosen goes back to `valueMissing` rather than to valid. The message survives
every selection change and a `form.reset()` — like a native control, only another
`setCustomValidity('')` clears it — and is used verbatim, never localized.

`ComboboxSourceRow = { value: string; label: string; sub?: string; icon?: unknown; badge?: string |
number; accessibleLabel?: string; data?: unknown; dotColor?: string; group?: string; disabled?:
boolean }` — the row shape used by the async `source` path. `icon` renders as a decorative leading
visual, `badge` as trailing metadata, `accessibleLabel` can provide richer spoken text than the
visible label, and `data` is retained without being rendered for retrieval through `selectedRows`.
`dotColor` accepts a valid CSS `color`; invalid values, declaration-breaking input, and `url()`
render a transparent dot.
The light-DOM `<lr-option>` path normalizes its supported label/sub/dot/group fields to the same
internal row model.

**Events:** typing in the filter exposes the original bubbling/composed, non-cancelable `InputEvent`
as exactly one host `input` event (no `value` detail) and does not fire `change`. An actual user
selection mutation — pointer or keyboard selection, multiple-value toggle, tag/Backspace removal, or
clear — emits exactly one bubbling/composed, non-cancelable `input` `CustomEvent`, immediately
followed by the same shape of `change`, then a prefixed `lr-change` alias. All three carry
`detail: { value }` — the new committed selection (a string in single mode, a `string[]` in
`multiple` mode). `lr-change` mirrors `<lr-checkbox>`'s namespaced alias; subscribe to it when you
want a `lr-`-prefixed event, or to the native-style `input`/`change` for parity with a native
control. Re-picking the current single value and programmatic/default/reset/restore writes are
silent (including on `lr-change`). The clear button emits one `lr-clear` after its
`input`/`change`/`lr-change` triple.
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

- Clearing a selection emits `input`, then `change`, then `lr-change`, then `lr-clear` — and, if the
  query was also non-empty, `lr-filter` with an empty `value`.
- A **query-only** clear (nothing selected, just typed text) emits `lr-filter` with an empty
  `value` and deliberately **no** `change` and **no** `lr-clear`. There was no selection
  transition to report, so announcing one would be a lie. Don't listen for `lr-clear` to detect
  "the user emptied the field" — listen for `lr-filter` when you care about the query.
- The query half of the render gate is scoped to states where the query is actually *visible*: an
  open listbox in single-select, or any time in `multiple` mode. A closed single-select shows the
  selected label rather than the query, so a stale query alone never surfaces a button offering to
  clear text the user cannot see.

**Large option lists: sizing `maxRender`, and why the listbox is not windowed.** Every row that
survives the filter and fits under `maxRender` is a real DOM element — the listbox renders its rows
in full rather than recycling a small window of them across a scroll. That is a deliberate
accessibility constraint, not an omission: the filter input carries `aria-activedescendant`, which
is an **IDREF**, and an IDREF only resolves within its own tree scope. Moving the rows into the
library's windowing primitive (`<lr-virtual-list>`) would place them one shadow root deeper than the
input that has to point at them, where neither the attribute nor its `ariaActiveDescendantElement`
element-reflection replacement can reach — element reflection resolves same-root or upward only. So
`<lr-virtual-list>` stays `role="list"`/`role="listitem"` and is the right tool for feeds and
viewers, not for a listbox whose active row must stay addressable.

What that means in practice:

- **Up to a few hundred rows, raise `maxRender` and move on.** A few hundred flex rows is an
  unremarkable amount of DOM; a country, currency, or time-zone list (typically 200–450 entries)
  renders comfortably with `max-render` set to cover it. The cap exists to bound pathological
  cases, not to make lists of that size expensive.
- **Past roughly a thousand rows, reach for `source` instead of a larger cap.** An async source
  narrows the candidate set before it ever becomes DOM, which is a categorically better trade than
  rendering everything and asking the browser to lay it out. Pair it with `sourceDelay` to debounce.
- **Leave the overflow row doing its job.** When the cap does bite, the excess collapses into one
  `overflowText` row (default `"+{n} more — refine your search"`) rather than disappearing
  silently, and the current selection is always kept visible even when it falls outside the cap.
  Suppressing that row by setting `maxRender` far above the real list size trades a useful "keep
  typing" affordance for layout work no user asked for.

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
standard size supplies an aligned default), plus shared tokens. `--lr-combobox-gap` (default
`--lr-space-xs`, the gap inside `[part='combobox']`) and `--lr-combobox-radius` (default
`--lr-radius`, its corner radius) are both retunable without a `::part(combobox)` rule but, unlike
the properties above, do not vary by `size` — the same `--lr-button-gap`/`-radius` pattern.

`--lr-combobox-option-active-bg` (default `var(--lr-color-brand-quiet)`) recolors the background of
a hovered or keyboard-active `[part='option']` row — the same per-component indirection
`lr-select`'s identical `--lr-select-option-active-bg` uses, so a consumer can retheme just this
row state without hijacking the shared `--lr-color-brand-quiet` token library-wide.

The currently-**selected** row (`[part='option'][aria-selected='true']`) has its own matching set:
`--lr-combobox-option-selected-bg` (default `transparent`), `--lr-combobox-option-selected-border`
and `--lr-combobox-option-selected-color` (both default `var(--lr-color-brand)`), and
`--lr-combobox-option-selected-font-weight` (default `var(--lr-font-weight-semibold)`) — the same
four-token indirection `lr-select`/`lr-model-select` already provide for their own selected row.
Like the active-bg knob these are inline `var()` fallbacks, not declared on `:host`, so a consumer
can retheme the selected row without hijacking `--lr-color-brand` library-wide.

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
  dot; invalid values, declaration-breaking input, and `url()` render the dot transparently)
- `label` is a **read-only getter**: explicit `label` attribute wins, else trimmed `textContent`.

**Events:** `lr-option-change` — bubbles when the option's label or selectable data changes so
its parent `lr-combobox` or `lr-select` can refresh its normalized option rows.

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
synchronous and fires no `input`/`change`/`lr-change` event.

**Known gotchas:**
- `with-clear` and `clearable` are equivalent and both are supported indefinitely; prefer
  `clearable` in new code. `lr-input` and `lr-select` accept both spellings too.
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

**Additional API surface:**

- `part="tag-label"` — The wrapping/ellipsis-safe selected-tag label.

---

## `lr-select`

A plain closed-list dropdown — a direct `<lr-*>` counterpart to `<wa-select>`/`<wa-option>`.
**Form-associated** (hand-rolled internals, not the shared `FormAssociated` mixin — same reasoning
as `lr-combobox`, see the shared-foundation notes above). The trigger is a `<button>`, not a text
input: click/Enter/Space/ArrowDown opens it, and there's no typing-to-filter. Options are
`<lr-option value>` children — the same element `<lr-combobox>` uses — reconciled the same way
combobox does, and the popup reuses `internal/positioner.ts` for placement.
Session-history/autofill restoration assigns the stored string through the same synchronous
value/form/validity path as a programmatic value write and does not emit `input`, `change`, or
`lr-change`.

There is no typing-to-filter and no `filter`/`source`/`empty-text`/`max-render` surface — reach for
`<lr-combobox>` instead whenever any of those apply. Everything else a closed list needs is here:
`multiple`, `max-options-visible`, `with-clear`, `getTag`, `placement`, `appearance`, and `pill`.

**Multi-select (`multiple`, new in 8.0.0, default `false`).** Setting it re-shapes `value` from a
`string` into a `string[]` and renders one chip per selection inside the trigger — a `[part="tags"]`
row holding one `[part="tag"]` each. Because the trigger is a real `<button>`, the chips are
deliberately non-interactive: a nested remove button would be invalid interactive-content nesting
and unreachable by keyboard or assistive tech anyway, since the outer button intercepts every
click/Enter/Space first. Removal has three affordances instead — pick a selected row again to
toggle it off, press Backspace or Delete on the focused trigger to drop the most recent selection,
or use the `with-clear` button to drop all of them at once. Turning `multiple` back off collapses
the selection to its first entry, so the single-mode string and the submitted entry can never
disagree with what the trigger shows.

A `multiple` select submits **one form entry per selected value** under its `name`, so
`new FormData(form).getAll(name)` behaves like a native multi-value control rather than returning a
joined string. An unnamed multi-select contributes nothing to the form at all, matching a nameless
native `<select multiple>`. Session-history/autofill state is a JSON string array in `multiple` mode
and the plain submitted string in single mode; malformed state restores an empty selection. The
listbox renders `aria-multiselectable` in **both** states (`"true"` and `"false"`), never omitting it.

**Breaking in 8.0.0:** `value` is now typed `string | string[]` even in single mode. A TypeScript
consumer that read it as a plain string needs a narrowing step —
`const v = el.value; const single = typeof v === 'string' ? v : (v[0] ?? '');`

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
- `size: LyraSize = 'm'` (reflected — the shared control ladder, same scale as
  `lr-input`/`lr-combobox`/`lr-button`, for compact toolbar placements that don't fit the default
  trigger height. Both spellings of every tier are accepted: `2xs`/`xs`/`s`/`m`/`l`/`xl` and
  `small`/`medium`/`large`)
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'`
  (reflected) — the library's shared field-surface vocabulary. `outlined` (the default) is a
  bordered surface; `filled` swaps the border for a raised fill; `filled-outlined` keeps both;
  `plain` drops both; `accent` paints the loud brand fill with on-brand text (the placeholder,
  expand icon, adornments and chips all ride that on-brand color rather than the quiet-text
  tokens). Every value keeps the same box, border width and radius, and each restates its own
  `:hover` feedback. Note the default differs from `<lr-input>`/`<lr-textarea>`, which default to
  `filled-outlined`
- `pill: boolean = false` (reflected) — fully-rounded trigger corners. It only re-assigns
  `--lr-select-radius` to `--lr-radius-pill`, so a consumer's own `--lr-select-radius` (inline or
  from an outer-tree rule) still wins over it
- `placement: Placement = 'bottom-start'` (reflected) — preferred listbox placement, from the
  Floating UI vocabulary (`'top'`, `'bottom-end'`, …). `flip`/`shift` may still move the popup to
  keep it in view, and the `left`/`right` component is swapped under RTL
- `multiple: boolean = false` (reflected) — several options selectable at once; see "Multi-select"
  above. Flipping it re-shapes `value` and the submitted form entry, so it is normally set once
  declaratively
- `maxOptionsVisible: number = 3` (attribute `max-options-visible`) — how many chips render in
  `multiple` mode before the rest collapse behind a localized "+N" chip. `0` removes the cap
  entirely. Sanitized to a finite, non-negative integer: a fractional value truncates, a negative
  one clamps to `0` (i.e. uncapped), and a non-finite one falls back to `3`
- `withClear: boolean = false` (attribute `with-clear`, reflected) — renders a clear button while
  anything is selected (and nothing at all while the selection is empty). It sits in the trigger's
  inline-end band as a **sibling** of the trigger rather than a child of it — same nesting reason as
  the chips — so pressing it clears the selection without opening the listbox
- `clearable: boolean = false` — Shoelace's spelling of `withClear`; either one renders the same
  button. Present so a mechanical `sl-select` → `lr-select` rename keeps the clear control
- `getTag?: LyraSelectTagRenderer` (attribute: false) — `(option: LyraOption, index: number) =>
  unknown`, exported under that name from the component's own module, renders one
  selected option's chip in `multiple` mode. Whatever it returns replaces the whole built-in
  `[part="tag"]` element, so re-declare `part="tag"` on your own root node to keep the default
  styling hooks. A returned **string renders as text, never as markup** (it lands in an ordinary
  Lit child position), and the same non-interactive-content constraint applies to whatever you
  return. Overflow past `max-options-visible` still collapses into the built-in "+N" chip
- `autoCommitSingleOption: boolean = false` (attribute `auto-commit-single-option`) — opts in to the
  single-option auto-commit behavior described above
- `value: string | string[]` — a getter/setter: a plain `string` in single mode (empty when nothing
  is selected), a `string[]` in `multiple` mode

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal trigger button.
`setCustomValidity(message)` carries a rejection no client-side constraint can express ("that option
is no longer available"): a non-empty message raises `customError`, becomes `validationMessage`, and
blocks submission; `''` clears it and restores the control's own computed validity, so a `required`
select with nothing chosen goes back to `valueMissing` rather than to valid. The message survives
every selection change and a `form.reset()` — like a native control, only another
`setCustomValidity('')` clears it — and is used verbatim, never localized.

**Events:** `change` (native-style — selection changed), `input` (fired alongside `change` on every
selection change — a native `<select>` doesn't meaningfully distinguish the two either), and
`lr-change` (a prefixed compatibility alias fired after both, mirroring `<lr-checkbox>`'s
`lr-change`). All three carry `detail: { value: string | string[] }` — the new committed selection,
a string in single mode and a `string[]` in `multiple` mode — and fire only on a real change, never
on a programmatic `value` write, `form.reset()`, or session-state restoration. Plus
`lr-clear` (no detail; emitted by the `with-clear` button *after* its `input`/`change`/`lr-change`
trio, and never when there was nothing to clear, so it never announces a no-op),
`lr-show`, `lr-hide`, and bubbling, composed `focus`/`blur` events re-dispatched from the internal
trigger.

**Slots:** default (`<lr-option>` children), `label`, `hint`, `error` (overrides the `errorText`
attribute when provided), `start` (non-interactive adornment before the selected-value label), and
`end` (non-interactive adornment after the label and before the expand icon). The adornments live
inside the native trigger `<button>`, so never place links, buttons, inputs, or other interactive
content in either slot.

When hint/error content is present, the trigger's `aria-describedby` references stable shadow-local
IDs for both messages (error first, then hint), so the visible supporting text is part of the
control's accessible description.

**CSS parts:** `form-control`, `form-control-label`, `trigger`, `start`, `end`, `tags` (the
`multiple`-mode chip row inside the trigger), `tag` (one selected-value chip), `tag-label` (a chip's
ellipsis-safe label), `tag-overflow` (the "+N" chip standing in for the selections past
`max-options-visible` — it carries **both** `tag` and `tag-overflow`, so `::part(tag)` styles every
chip while `::part(tag-overflow)` reaches only that one; state after `::part()` never matches, so it
is encoded in the part name instead), `clear-button` (the `with-clear` button, present only while
there is a selection to clear), `listbox`,
`group-label` (a heading row emitted inside the listbox whenever an option's `group` differs from
the previous one's — a presentational `<div>`, not a `role="group"`; options with an empty `group`
get no heading),
`option`, `option-dot` (the leading status dot, when a row's `dotColor` is set), `option-label`,
`option-sub` (a row's secondary line, when `sub` is set), `expand-icon`, `error`, `hint`

**Themeable custom properties:** `--lr-select-trigger-padding`, `--lr-select-trigger-min-height`,
`--lr-select-font-size`, `--lr-select-expand-size` — all four auto-swapped per `size` (`xs`…`xl`), the same pattern
`lr-toast-item`'s `--lr-toast-padding`/`--lr-toast-font-size` use. `--lr-select-gap` (default
`--lr-space-xs`, the gap inside `[part='trigger']`) is retunable without a `::part(trigger)` rule
and does not vary by `size` — the adornment gap a field wants is looser than the icon-beside-label
gap the ladder is tuned for. `--lr-select-radius` (default `--lr-form-control-radius`, the corner
radius) is retunable the same way but *does* follow the tier: the two tightest tiers take a smaller
radius, since a 6px corner on a 20px-tall control reads as a lozenge. `pill` re-assigns it to
`--lr-radius-pill`. `--lr-select-tag-padding`
(default `var(--lr-space-2xs) var(--lr-space-xs)`) and `--lr-select-tag-font-size` (default
`var(--lr-font-size-sm)`) size a `multiple`-mode chip; like gap and radius they are declared once on
`:host` and do **not** vary by `size` tier.

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

The currently-**selected** row (`[part='option'][aria-selected='true']`) has its own matching set:
`--lr-select-option-selected-bg` (default `transparent`), `--lr-select-option-selected-border` and
`--lr-select-option-selected-color` (both default `var(--lr-color-brand)`), and
`--lr-select-option-selected-font-weight` (default `var(--lr-font-weight-semibold)`). Like the
active-bg knob these are inline `var()` fallbacks, not declared on `:host`, so a consumer can
retheme the selected row without hijacking `--lr-color-brand` library-wide. Note the shadow-parts
spec forbids an attribute selector after `::part()` — `::part(option)[aria-selected='true']` is
invalid CSS and never matches — which is exactly why these tokens exist.

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

```html
<!-- Multi-select with chips, a cap, and a clear button: -->
<lr-select id="tags" label="Labels" multiple with-clear max-options-visible="2" appearance="filled" pill>
  <lr-option value="bug">Bug</lr-option>
  <lr-option value="docs">Docs</lr-option>
  <lr-option value="perf">Performance</lr-option>
</lr-select>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/select/select.js';
  const sel = document.getElementById('tags');
  // A custom chip: return a node, and re-declare part="tag" to keep the built-in styling hooks.
  sel.getTag = (option, index) => `${index + 1}. ${option.label}`; // a string renders as text
  sel.addEventListener('change', (e) => console.log(e.detail.value)); // string[] in multiple mode
  sel.addEventListener('lr-clear', () => console.log('selection emptied'));
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
- `clearLabel: string = ''` (attribute `clear-label` — accessible label for the clear button;
  empty uses the localized `clear` message, whose English fallback is `"Clear"`)
- `openLabel: string = ''` (attribute `open-label` — accessible label for the calendar-toggle
  button; empty uses the localized `openCalendar` message, whose English fallback is
  `"Open calendar"`)
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
- `size: LyraSize = 'm'` (reflected) — visual size on the shared control ladder, matching
  `lr-input`/`lr-select`/`lr-combobox`/`lr-button`; both `2xs`/`xs`/`s`/`m`/`l`/`xl` and
  `small`/`medium`/`large` are accepted. Governs the field's padding and font-size;
  the calendar-toggle and clear buttons keep a constant, accessible touch target at every size.
  The default `m` tier is unchanged from this component's pre-`size` rendering.
- `pill: boolean = false` (reflected) — rounds the input row's corners to a full pill, mirroring
  `lr-input`'s own `pill`. It only re-assigns `--lr-date-input-radius` to `--lr-radius-pill`, so a
  consumer setting that property directly still wins for a bespoke shape

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
`--lr-date-input-control-min-height` (default `--lr-form-control-height`, i.e. `2.5rem` at the
default `m` tier) — the `input-wrapper`'s block-size
floor. All four are declared on `:host` and auto-swapped per `size`
(`2xs`/`xs`/`s`/`l`/`xl`; `m` keeps the `:host` defaults), using the same per-`size` values
`lr-input` uses. `pill` re-assigns `--lr-date-input-radius` to `--lr-radius-pill`. Plus shared
tokens.

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

**Additional API surface:**

- `--lr-date-picker-month-gap` — Gap between visible months. Default: `var(--lr-space-l)`.
- `--lr-date-picker-header-gap` — Month-header child gap. Default: `var(--lr-space-s)`.
- `--lr-date-picker-radius` — Calendar and control corner radius. Default: `var(--lr-radius)`.
- `--lr-date-picker-nav-hover-bg` — Hover background of the previous/next month-navigation buttons.
  Default: `var(--lr-color-brand-quiet)`. An inline `var()` fallback rather than a `:host`
  declaration, and the rule wraps its selector in `:where()` so a consumer's own
  `::part(previous):hover` still wins without `!important`.
- `--lr-date-input-placeholder-color` — Placeholder text color. Default: `var(--lr-color-text-quiet)`.
- `--lr-date-input-gap` — Gap between input-row children. Default: `var(--lr-space-xs)`.
- `--lr-date-input-radius` — Input-row corner radius. Default: `var(--lr-radius)`.
- `--lr-date-input-focus-border-color` — Focused row border color. Default: `var(--lr-color-brand)`.

---

## lr-textarea

A multiline plain-text input primitive, form-associated (participates in native `<form>`
submission/validation/reset via `name`/`value`/`disabled`/`required`/`checkValidity()`/
`reportValidity()`). Ships an opt-in `label`/`hint`/`errorText` form-control chrome mirroring
`lr-select` -- left unset, none of it renders.

```html
<lr-textarea placeholder="Notes" rows="4"></lr-textarea>
<lr-textarea label="Bio" maxlength="280" with-count appearance="outlined" size="s" resize="auto"></lr-textarea>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/textarea/textarea.js';
  const bio = document.querySelector('lr-textarea[label="Bio"]');
  await bio.updateComplete;                    // both calls are no-ops before the first render
  bio.scrollPosition({ top: 0 });              // pin a restored draft back to the top
  console.log(bio.scrollPosition());           // -> { top: 0, left: 0 }
</script>
```

### Properties

| Property | Attribute | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `value` | `value` | `string` | `''` | The current text value. |
| `rows` | `rows` | `number` | `3` | Visible text rows. |
| `resize` | `resize` | `'none' \| 'vertical' \| 'horizontal' \| 'both' \| 'auto'` | `'vertical'` | Native CSS `resize` behavior, plus `'auto'` (`ResizeObserver`-driven grow-to-content, no manual handle). An invalid runtime value falls back to `'vertical'`; `'auto'` maps native CSS resize to `none`. |
| `size` | `size` | `LyraSize` | `'m'` | Visual size on the shared control ladder — the same scale as `lr-input`/`lr-select`/`lr-button`, and both spellings of every tier are accepted (`2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`). Governs the field's padding, font size and corner radius. Reflected. |
| `appearance` | `appearance` | `'accent' \| 'filled' \| 'outlined' \| 'filled-outlined' \| 'plain'` | `'filled-outlined'` | Visual treatment of the field, with the same meanings as `lr-input`'s `appearance`: `filled-outlined` draws both fill and border, `outlined` drops the fill, `filled` drops the border, `plain` drops both, `accent` tints both with the brand color. Each value does nothing but swap `--lr-textarea-fill`/`--lr-textarea-border-color`. Reflected. |
| `pill` | `pill` | `boolean` | `false` | Fully rounded field corners, matching `lr-input`'s/`lr-select`'s own `pill` — both upstreams ship it on their textarea, so a mechanical tag rename must not drop it. It only re-assigns `--lr-textarea-radius` to `--lr-radius-pill`, so that property stays the single corner-radius knob and a consumer override still wins. Most useful on a one- or two-row field: a tall multi-line surface with fully rounded ends wastes its first and last line's inline space, which is why it is opt-in rather than tied to `size`. Reflected. |
| `withCount` | `with-count` | `boolean` | `false` | Renders a character count below the field, inside `[part="footer"]`. With `maxlength` set it counts *down* the remaining characters instead of up from zero. Reflected. |
| `placeholder` | `placeholder` | `string` | `''` | Placeholder text. |
| `readonly` | `readonly` | `boolean` | `false` | Native read-only behavior: prevents user edits while preserving focus, selection/copy, form submission, and silent programmatic editing methods. Reflected. |
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
| `minlength` | `minlength` | `number \| undefined` | `undefined` | Minimum text length; forwarded to the native `<textarea>` and reported as `validity.tooShort`. |
| `maxlength` | `maxlength` | `number \| undefined` | `undefined` | Maximum text length; forwarded to the native `<textarea>` (which also stops typing past it) and reported as `validity.tooLong`. |
| `name` | `name` | `string` | `''` | Form field name. |
| `disabled` | `disabled` | `boolean` | `false` | Disables the control. |
| `required` | `required` | `boolean` | `false` | Participates in native constraint validation. |

### Constraint validation

`validity` reports `valueMissing` (from `required`), `tooShort` (from `minlength`), and `tooLong`
(from `maxlength`) — the complete set a native `<textarea>` can produce. Leaving `minlength` and
`maxlength` unset constrains nothing, exactly as before they existed.

While `readonly`, all three constraint flags are suspended and `checkValidity()` succeeds, matching
native textarea behavior. The value remains a successful form value and is restored by form reset;
unsetting `readonly` restores the applicable required and length constraints.

Two behaviors are worth knowing, both inherited from the platform and both shared with `lr-input`:

- **An empty value is never `tooShort`.** Native `minlength` only applies to a non-empty value, so
  an optional field left blank stays valid; `required` is what rejects empty.
- **A script-assigned value is validated too.** The native `tooShort`/`tooLong` flags are raised
  only for a value the *user* edited, so the component recomputes both from its own `value` and
  ORs them in — `el.value = <over-length>` reports `tooLong` rather than silently submitting.
  Lengths count UTF-16 code units, matching the native control (one emoji counts as two).
  `validationMessage` is the browser's own localized message when the native control flagged the
  value, and the localized `valueInvalid` string when only the script-value check did.

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
| `scrollPosition(position?)` | Read or write the internal textarea's scroll offsets. Called with no argument it returns the current `{ top, left }`; called with a partial `{ top?, left? }` it writes only the axes present and returns `undefined`. Returns `undefined` either way before the internal textarea has rendered, and a non-finite offset leaves that axis alone. This is the one piece of scroll state no other public member reaches — use it to restore a draft, or to pin a long value to its end. |
| `setFormValue(value)` | Set the reactive and submitted value synchronously. |
| `checkValidity()` / `reportValidity()` | Run native constraint validation through `ElementInternals`. |

### Events

| Event | Detail | Description |
| --- | --- | --- |
| `input` | none | Native-style composed event fired on every user-driven edit. |
| `change` | none | Native-style composed event fired at native `change` timing. |
| `lr-input` | `{ value: string }` | Compatibility alias fired on every user-driven edit. |
| `lr-change` | `{ value: string }` | Compatibility alias fired on native `change` timing (blur after a committed edit). |
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
| `textarea-wrapper` | A plain block box around the native `<textarea>`. It deliberately imposes no size of its own — the native resize grip writes inline `width`/`height` onto the `<textarea>` itself, so the field drives the box. Use it to place chrome alongside the field; the padding/border/fill live on `textarea`. |
| `textarea` | The native `<textarea>` element. |
| `footer` | The row below the field carrying the character count. Always in the DOM but `hidden` without `with-count`. |
| `count` | The character count text, rendered only with `with-count`. |
| `hint` | The hint message. |
| `error` | The error message. |

The visible `[part="count"]` is `aria-hidden`; a separate polite live region beside it republishes
the same text about a second after the user stops typing, so a screen reader is not told the count
on every keystroke. Lengths count UTF-16 code units (one emoji counts as two), matching the native
`maxlength` the count reports against, and the remaining count floors at zero — only a
script-assigned value can exceed `maxlength`, and the `tooLong` validity flag already reports that
state better than a negative number would. An unparseable `maxlength` (`maxlength="oops"`) is
dropped rather than rendered as `NaN`, and the count counts up from zero instead.

### Themeable custom properties

- `--lr-textarea-max-block-size` (default `none`) — bounds `resize="auto"`; content beyond the
  bound scrolls inside the native textarea. Auto-resize remeasures after user edits, programmatic
  `value`/`rows` changes, range edits, and container-width changes.
- `--lr-textarea-padding` (default `var(--lr-form-control-padding-inline)`),
  `--lr-textarea-font-size` (default `var(--lr-form-control-font-size)`) and
  `--lr-textarea-radius` (default `var(--lr-form-control-radius)`) — the native textarea's padding,
  font size and corner radius. All three read the active `size` tier of the shared control ladder,
  so they follow the tier with no per-tier rule of their own; the two tightest tiers take a smaller
  radius. `pill` re-assigns `--lr-textarea-radius` to `--lr-radius-pill`.
- `--lr-textarea-fill` (default `var(--lr-color-surface)`) and `--lr-textarea-border-color` (default
  `var(--lr-color-border)`) — the field's background and border color, both swapped per
  `appearance` rather than per `size`. The documented defaults are `appearance="filled-outlined"`'s
  values, and both are also declared bare on `:host` so an element whose `appearance` attribute
  hasn't reflected yet still paints the committed default. Set either directly to retune the
  surface without a `::part(textarea)` rule.

**Additional API surface:**

- `click()` — Activates the internal textarea.

---

## `lr-button`

A generic action-button primitive. Renders an internal native `<button>`; `type="submit"`/
`type="reset"` are handled by the component itself via the host's own `closest('form')`, since a
shadow-internal native button doesn't participate in an ancestor form's submission on its own.

Set `href` to a safe link URL and the root renders as a real `<a part="base" href=…>` instead — a
link styled as a button (e.g. a CTA). Native navigation is then the activation, so the submit/reset
handling and `type` have no effect in that mode. A disabled link button (its own `disabled` or an
ancestor `<fieldset disabled>`) renders the anchor with `aria-disabled="true"` and **no `href`**, so
it is neither focusable nor navigable; an unsafe/unparseable `href` falls back to the native
`<button>`.

**Properties:**
- `href?: string` — when set to a safe link URL (`http:`/`https:`/`blob:`/`mailto:`/relative; see
  `safeLinkHref`), the root renders as an `<a href=…>` instead of a `<button>`. Setting `download`
  narrows the allowlist to `http:`/`https:`/`blob:`/relative — `mailto:` names no retrievable bytes,
  so a `mailto:` href paired with `download` falls back to the native `<button>`. Unset (the default)
  renders a plain `<button>`, unchanged. `type` (submit/reset) has no effect while the anchor
  renders. While the button is disabled the anchor is rendered **without** `href` (keeping
  `aria-disabled="true"`), so a disabled link button cannot navigate. An unsafe/unparseable value
  falls back to the native `<button>`
- `target?: string` — native anchor `target`, used only while `href` resolves to a link. Setting it
  (e.g. `'_blank'`) automatically derives `rel="noopener noreferrer"` on the anchor; `rel` is never
  independently settable (reverse-tabnabbing). Ignored in `<button>` mode
- `download?: string` — native anchor `download` attribute, used only while `href` resolves to a
  link. Ignored in `<button>` mode
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected)
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' | 'quiet' | 'link' =
  'accent'` (reflected) — the library's shared fill vocabulary plus this component's own two extra
  tiers. **Breaking in 8.0.0: the default moved from `'filled'` to `'accent'`**, so a bare
  `<lr-button>` now paints the loud fill it used to need `appearance="accent"` for. The two are no
  longer near-duplicates: `'accent'` takes the active `variant`'s **loud** fill
  (`--lr-button-accent-fill`) with the foreground guaranteed legible on it, while `'filled'` takes
  that variant's **quiet** tint (`--lr-button-fill`) — a secondary-action fill that still reads as a
  fill rather than as the page surface. Before 8.0.0 every chromatic variant's `'filled'` and
  `'accent'` resolved to the same loud token and rendered identically, while `variant="neutral"`'s
  `'filled'` was the page surface, i.e. no fill at all. `'filled-outlined'` is `'filled'`'s fill and
  foreground carrying the outlined tier's border colour, for a filled button that must still read as
  bounded on a same-toned surface. `'quiet'` is a de-emphasized tier:
  transparent background with a bordered, muted-text chrome; its text/border tokens are **not**
  variant-swapped, so `variant` has no effect on it.
  `'link'` is a true inline-link tier:
  zero chrome (no padding, border, border-radius, or `min-block-size` floor), underlined
  (`text-underline-offset: var(--lr-size-0-15rem)`), colored from `--lr-button-accent` (the same token `'plain'`
  uses, so `variant` still selects the link color) and inheriting the surrounding font-size/weight
  — for a text link that flows within a sentence rather than a button-shaped control. Declared
  after the per-`size` rules, so it overrides them whatever `size` is set
- `size: LyraSize = 'm'` (reflected) — the shared control ladder. `'2xs'` is the tightest tier,
  below `'xs'`, for dense chrome; `'m'` is the standard one. Both spellings of every tier are
  accepted — `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large` — and the same ladder drives
  `lr-input`/`lr-select`/`lr-combobox`/`lr-date-input`, so same-`size` controls share a height by
  construction rather than by two lists agreeing
- `pill: boolean = false` (reflected) — fully rounded ends. It re-assigns `--lr-button-radius` to
  `--lr-radius-pill` rather than declaring a radius on `[part="base"]`, so that property stays the
  single corner-radius knob and a consumer override still wins. `appearance="link"` renders with
  zero chrome, pill or not
- `withCaret: boolean = false` (attribute `with-caret`, reflected) — renders a decorative trailing
  chevron (`[part="caret"]`, `aria-hidden`) marking the button as a dropdown/menu trigger. It
  carries no accessible name of its own: the button's label already names the action, and the popup
  relationship is expressed by a host `aria-haspopup`/`aria-expanded`, which are forwarded to the
  internal control. Like the label and the two adornment slots it fades to `opacity: 0` while
  `loading`, so the spinner has the button to itself
- `type: 'button' | 'submit' | 'reset' = 'button'`
- `loading: boolean = false` (reflected) — shows an internal spinner and disables the button without
  clearing `disabled`
- `disabled: boolean = false` (reflected)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name forwarded
  reactively to the internal native button or anchor; changing or removing the attribute after
  mount updates the actual focused control

**Submitter overrides (`type="submit"` in `<button>` mode).** `name`/`value` plus the five native
`form*` overrides describe the submission this button triggers, not the button itself:

- `formAction?: string` (attribute `formaction`) — overrides the form owner's `action`. Unset by
  default, leaving the form's own `action` in place; an empty string is deliberately *not*
  forwarded, since an empty `formaction` resolves against the document URL and would silently
  redirect the submission
- `formEnctype?: 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'`
  (attribute `formenctype`) — overrides the form owner's `enctype`
- `formMethod?: 'get' | 'post' | 'dialog'` (attribute `formmethod`) — overrides the form owner's
  `method`; `'dialog'` closes an ancestor `<dialog>` instead of submitting
- `formNoValidate: boolean = false` (attribute `formnovalidate`) — skips the form owner's
  constraint validation. Without it an invalid form is reported and not submitted, exactly as with
  a native submit button
- `formTarget?: string` (attribute `formtarget`) — overrides the form owner's `target`. Distinct
  from `target`, which is the anchor target used in link mode

All five are `undefined`/`false` by default. When any of them — or `name`/`value` — is set, the
submission runs through a **transient native `<button type="submit">`** inserted directly after the
host, used as `requestSubmit()`'s submitter and removed again in the same synchronous step (in a
`finally`, so a throwing or validation-blocked submission can't leave it behind). That is what makes
the name/value pair reach the submitted `FormData` and the overrides reach the real submission:
`requestSubmit()` only accepts a submitter the form actually owns, and a custom element is never
one. While that stand-in exists it *is* the form's submitter, so **`SubmitEvent.submitter` is the
transient native button, not this host**. With none of those properties set, submission stays a
plain `requestSubmit()` with a `null` submitter, and all of it is inert in link mode.

Each size tier's `min-block-size` floor is exposed as its own token (see below).

**Getters/methods:** `click()`, `focus(options?)`, and `blur()` — forwarded to the internal base
element (the `<button>`, or the `<a>` in anchor mode); `click()` also runs the component's
submit/reset behavior in `<button>` mode.

**Events:** none (a plain native `click` bubbles and composes through the shadow boundary
unmodified; disabled while `disabled` or `loading`).

**Slots:** default (label content), `start` (leading icon/content), `end` (trailing icon/content).

**CSS parts:** `base` (the internal native `<button>`, or an `<a>` when `href` resolves to a safe
link), `label`, `start`, `end`, `caret` (the decorative dropdown chevron, present only while
`with-caret` is set), `spinner` (present only while `loading`).

**Themeable custom properties.** The colour slots below are re-pointed at the active `variant`'s row
of the library's shared semantic colour grid, so the component carries no `:host([variant='…'])`
block of its own — the ones marked variant-independent are the exceptions:

- `--lr-button-accent` (default `--lr-color-fill-loud`) — text/glyph colour for the chrome-less
  tiers (`outlined`, `plain`, `link`), i.e. the variant's loud fill borrowed as a foreground.
  `variant="neutral"` is the one exception: its loud fill is a mid grey picked to carry *light*
  text, so reusing it as dark-on-surface text would wash out every plain and link button — neutral
  keeps `--lr-color-text` instead.
- `--lr-button-fill` (default `--lr-color-fill-quiet`) and `--lr-button-on-fill` (default
  `--lr-color-on-quiet`) — the `appearance="filled"`/`"filled-outlined"` fill and its
  guaranteed-legible foreground.
- `--lr-button-accent-fill` (default `--lr-color-fill-loud`) and `--lr-button-accent-on-fill`
  (default `--lr-color-on-loud`) — the same pair for `appearance="accent"`, the default tier. The
  accent fill is also that tier's border colour.
- `--lr-button-border` (default `--lr-color-border-normal`) — the border colour, from the active
  variant's row.
- `--lr-button-outlined-border` (default `--lr-color-border-strong`) — the border colour of
  `appearance="outlined"` *and* `"filled-outlined"`, overriding `--lr-button-border`. Deliberately
  variant-independent.
- `--lr-button-outlined-fill` (default `transparent`) — the `appearance="outlined"` background, also
  variant-independent. Set it to tint an outlined button (a faint surface wash behind the outline)
  without a `::part(base)` rule, and point `--lr-button-hover-base` at the same colour so the hover
  and press states keep moving away from what is actually painted.
- `--lr-button-quiet-text` (default `--lr-color-text-quiet`) and `--lr-button-quiet-border` (default
  `--lr-color-border`) — the `appearance="quiet"` foreground/border pair, variant-independent too.

Hover and press are **colour mixes, not a filter** — `--lr-button-hover-base` (default
`--lr-color-surface`) is the colour both move away from, and each painted tier re-points it at the
fill it actually paints (`--lr-button-fill` for `filled`/`filled-outlined`, `--lr-button-accent-fill`
for `accent`); the chrome-less tiers paint nothing, so they mix from the page surface.
`--lr-button-hover-background` (default `color-mix(in oklab, var(--lr-button-hover-base),
var(--lr-color-mix-partner) var(--lr-color-mix-hover))`) is the hovered background and
`--lr-button-active-background` the same mix at the stronger `--lr-color-mix-active` share, so a
press reads as more than a hover. `appearance="link"` moves its text colour by those two shares
instead of taking a background. **Breaking in 8.0.0:** this replaced `--lr-button-hover-brightness`,
which no longer exists — a `filter: brightness()` multiplies every channel, so it moved a mid-toned
fill but did nothing at all to a pure white or pure black one, and it dimmed the label and icons
along with the box. Retuning `--lr-button-fill` or `--lr-button-accent-fill` now retunes that tier's
hover and press with it.

`--lr-button-width` (default `100%`) is the internal control's inline size, so it follows the host's
own width; override it to `auto` for a compact inline composition. `--lr-button-active-scale`
(default `0.9875`) is the `:active` press-scale, dropped under `prefers-reduced-motion`.
`--lr-button-spinner-duration` (default `var(--lr-transition-ambient)`, i.e. `1.8s ease-in-out`) is
the `loading` spinner's rotation period; that token itself collapses to `0.001ms linear` under
`prefers-reduced-motion`, so the spinner effectively stops.

The per-`size` `min-block-size` floors are `--lr-button-size-2xs`, `--lr-button-size-xs`,
`--lr-button-size-s`, `--lr-button-size-m`, `--lr-button-size-l` and
`--lr-button-size-xl`. Each defaults to the matching tier of the shared form-control ladder
(`--lr-form-control-height-2xs` … `-xl`, i.e. 1.25rem, 1.5rem, 1.875rem, 2.5rem, 3rem, 3.5rem), so a
button is the same height as an input, select, combobox or date input of the same tier *by
construction* rather than by two hand-maintained lists agreeing — which is exactly how they drifted
apart before 8.0.0. Each is read only by its own tier (`--lr-button-size-s` also serves
`size="small"`, and so on for the other two aliases), and all are ignored by `appearance="link"`.
Retheming `--lr-theme-form-control-height-*` moves every control on the ladder together.

`--lr-button-gap` (default `--lr-form-control-gap`, the gap between the icon/label and any slotted
content) does not vary by tier. `--lr-button-radius` (default `--lr-form-control-radius`, the corner
radius) *does* follow the tier — the two tightest tiers take a smaller radius, since a 6px corner on
a 20px-tall control reads as a lozenge. Both are retunable without a `::part(base)` rule;
`appearance="link"` ignores the radius (it renders with zero), and `pill` re-assigns it to
`--lr-radius-pill`. `--lr-button-caret-size` (default `var(--lr-size-0-75em)`) is the `with-caret`
chevron's font size — declared in `em`, so it tracks every `size` tier through the button's own font
size instead of needing a per-tier value.
`--lr-button-shadow` is **undeclared by default**, so `box-shadow` falls back to `none` —
byte-identical to before this property existed — set it to add a drop shadow (e.g. an
elevated/floating action button) without a `::part(base)` rule.

**Retuning one `size` tier's geometry, without a `::part(base)` rule.** Four more properties carry
the active tier's geometry, and every `:host([size='…'])` rule does nothing but re-assign them — no
per-tier rule ever declares a property on `[part='base']`. Overriding one therefore retunes
whatever tier is active (e.g. pinning a `size="s"` button into a compact toolbar row), the same
pattern `lr-input`/`lr-select`/`lr-combobox`/`lr-segmented`/`lr-date-input` follow. Each defaults to
the shared ladder's value for the active tier, which at the default `m` tier resolves to the values
in brackets:

- `--lr-button-padding-block` (default `--lr-form-control-padding-block`; `--lr-space-xs` at `m`)
- `--lr-button-padding-inline` (default `--lr-form-control-padding-inline`; `--lr-space-m` at `m`)
- `--lr-button-font-size` (default `--lr-form-control-font-size`; `--lr-font-size-m` at `m`)
- `--lr-button-min-height` (default `--lr-form-control-height`) — the active tier's `min-block-size`
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
<!-- appearance defaults to "accent": the loud fill, for the one primary action in a view. -->
<lr-button variant="brand">Save</lr-button>
<!-- "filled" is the quiet tint of the same tone, for a secondary action beside it. -->
<lr-button variant="brand" appearance="filled">Save a copy</lr-button>
<lr-button appearance="plain" aria-label="Close dialog"><svg slot="start">...</svg></lr-button>
<p>The message failed. <lr-button appearance="link" variant="brand">Retry</lr-button></p>

<lr-button pill with-caret aria-haspopup="menu" aria-expanded="false">Actions</lr-button>

<form action="/save" method="post">
  <lr-input name="title" label="Title" required></lr-input>
  <lr-button type="submit" name="intent" value="draft" formnovalidate formaction="/save-draft">
    Save draft
  </lr-button>
  <lr-button type="submit" name="intent" value="publish">Publish</lr-button>
</form>
```

**Known gotchas:**
- `accessibleLabel`/a host `aria-label` is forwarded reactively to the internal button or anchor as
  a literal string (for an icon-only button). Host `aria-describedby` targets in the host's root
  are resolved onto the focused internal control through `ariaDescribedByElements`; external
  `aria-labelledby` is not copied across the shadow boundary.
- Host `aria-haspopup` and `aria-expanded` values are forwarded to the internal semantic control.
  For host `aria-controls`, targets in the host's own root are resolved through the reflected
  element-reference API so a popup relationship survives the component's shadow boundary; browsers
  with that API expose the relationship through `ariaControlsElements` and intentionally serialize
  the `aria-controls` content attribute as an empty string. Browsers without the API retain the
  forwarded string attribute as a best-effort fallback. A reflected element list and a non-empty
  serialized string cannot coexist; this is what lets either button serve as an `lr-menu` trigger.
- Is form-associated (`static formAssociated = true` + `attachInternals()`), so it participates in
  an ancestor `<form>.elements` the same way `wa-button` does — a sibling text field's own
  Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) finds it.
- **`SubmitEvent.submitter` is not this element** whenever `name`/`value` or any `form*` override is
  set: it is the transient native `<button>` described above, which has already been removed from
  the DOM by the time a `submit` listener runs. Read the submitted entry from the `FormData`, or
  the override off your own component, rather than identity-checking the submitter.
- The `form*` overrides and `type` are all inert while `href` renders the anchor — native navigation
  is the activation there, and an anchor has no submit/reset concept.

---

## `lr-icon-button`

An accessible icon-only action button — a form-associated custom element with a native `<button>`
inside. Its `type="submit"`/`"reset"` behavior is forwarded to the ancestor form by the component.

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

Host `aria-haspopup` and `aria-expanded` values are forwarded reactively to the shadow-internal
native button. Host `aria-describedby` targets in the host's own root are resolved through
`ariaDescribedByElements`. Host `aria-controls` targets use the corresponding
`ariaControlsElements` API, so using `<lr-icon-button slot="trigger">` inside `<lr-menu>` exposes
the menu relationship and expanded state on the element that actually receives focus. Supporting
browsers intentionally clear each serialized internal IDREF attribute after its explicit element
list is assigned. Browsers without those APIs retain the forwarded string attributes as
best-effort fallbacks.

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
custom-content slot uses. The `[part="fallback"]` svg carries the same `fill="none"
stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"` defaults
`<lr-icon>`'s own wrapper svg does, so bare stroke-style geometry (the common lucide/feather/tabler
path-data shape, which carries no fill/stroke of its own) renders outlined instead of as a solid
shape; an explicit `fill`/`stroke`/etc. already present on the slotted node still wins for that
node. This is narrowly scoped to that whitelist: a complete `<svg>`, `<img>`, or custom element
(e.g. `<lr-flag>`) is never touched by it and keeps rendering as an untouched sibling at its own
natural aspect ratio.

**CSS parts:** `button`, `fallback` (only present in the DOM while at least one top-level slotted
element needs the bare-geometry fallback above)

**Themeable custom properties:** `--lr-icon-button-size` (default `2.5rem`) is the **minimum**
tappable inline and block size of the native button — a floor, not a fixed size. Content larger
than it grows the button and keeps its own aspect ratio; a small glyph pads out to it. It is a
library-wide token (declared on `:root` by the token layer, and the shared minimum tappable size
that several other components size their icon-only controls against), so overriding
`--lr-theme-icon-button-size` globally resizes all of them together. Keep the resolved value at or
above 24px — see `llms/shared.md`. `--lr-icon-button-radius` (default `--lr-radius`) is the
`[part='button']` corner radius, retunable without a `::part(button)` rule — the same
`--lr-button-radius` pattern; `lr-icon-button` has no `size` tiers, so there is no per-tier gap
counterpart to it.

The rest come in resting/hover/pressed triples, each falling through to the next-quieter state so
setting only one still behaves:

- `--lr-icon-button-background` (default `transparent`),
  `--lr-icon-button-background-hover` (default `color-mix(in oklab, var(--lr-color-surface),
  var(--lr-color-mix-partner) var(--lr-color-mix-hover))`) and
  `--lr-icon-button-background-active` (the same mix at the stronger `--lr-color-mix-active` share,
  so a press reads as more than a hover) — the `[part='button']` background in each state. The
  hover fallback used to be `--lr-color-surface` itself, i.e. the page background, so hovering an
  icon button on a default page changed nothing at all.
- `--lr-icon-button-color` (default `inherit`), `--lr-icon-button-color-hover` (default
  `var(--lr-icon-button-color, inherit)`) and `--lr-icon-button-color-active` (default
  `var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))`) — the icon/text colour.
- `--lr-icon-button-border` (default `0`), `--lr-icon-button-border-hover` (default
  `var(--lr-icon-button-border, 0)`) and `--lr-icon-button-border-active` (default
  `var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))`) — the *complete* native
  border shorthand, replaced wholesale in each state rather than merged.

These are the same per-component indirection `lr-button`'s
`--lr-button-fill`/`--lr-button-on-fill` provide, letting a single button be bordered and tinted
without a `::part(button)` rule. All nine are undeclared by default and read as inline `var()`
fallbacks, so setting only the resting value carries through hover and press, and setting none of
them leaves rendering unchanged.

## `lr-input`

A single-line plain-text input primitive, the `lr-*` equivalent of a plain `wa-input`,
form-associated via the same `FormAssociated` mixin as `lr-textarea`. Ships the same opt-in
`label`/`hint`/`errorText` form-control chrome as `lr-textarea`/`lr-select`, and the same
`size` scale as `lr-select`/`lr-combobox`.

Pressing Enter submits the ancestor `<form>` — the implicit submission a native `<input>` performs;
see "Enter-to-submit" below for the exact rules and for which controls deliberately opt out.

**Properties:**
- `type: LyraInputType = 'text'` — `'text' | 'password' | 'email' | 'number' | 'time' | 'search'`
- `size: LyraSize = 'm'` (reflected — see "Shared form vocabulary" below)
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'filled-outlined'`
  (reflected) — the shared field-surface vocabulary. `filled-outlined` (the default) draws both a
  surface fill and a border; `outlined` drops the fill, `filled` drops the border, `plain` drops
  both, and `accent` tints both with the brand color. Each value does nothing but swap
  `--lr-input-fill`/`--lr-input-border-color`, so either can be retuned without a
  `::part(input-wrapper)` rule
- `pill: boolean = false` (reflected) — rounds the control row to a full pill by swapping
  `--lr-input-radius` to `--lr-radius-pill`
- `autofocus: boolean = false` — forwarded to the internal native `<input>` rather than left on the
  host, so the browser's own autofocus algorithm targets the real text control (the custom-element
  host is not focusable). Left unset, the native attribute is omitted entirely
- `value: string = ''` (from `FormAssociated`)
- `placeholder: string = ''`
- `clearable: boolean = false` (reflected) — shows a localized clear action while a `text` or
  `search` input has a value; clearing preserves input focus
- `withClear: boolean = false` (attribute `with-clear`) — Web Awesome's spelling of `clearable`;
  either one shows the same action. Inherited by `lr-number-input` and `lr-time-input`, where it is
  inert for the same reason `clearable` is (neither type renders a clear action)
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
- `min?: number | string` / `max?: number | string` (attributes `min`/`max`) /
  `step?: number | 'any'` (attribute `step`, accepts the native `'any'` value alongside a number)
  — forwarded verbatim to the native
  input and validated by it. Intended for `type="number"`; `step` is equally meaningful on
  `type="time"`. On `lr-input` itself the `min`/`max` *attributes* are number-converted, so a
  non-numeric bound only survives a direct property assignment; the declared type also admits a
  string so a subclass can narrow the attribute parsing to its own native type's literal form —
  `lr-time-input` does exactly that. Inert for the other types
- `minlength?: number` / `maxlength?: number` (attributes `minlength`/`maxlength`) — text-length
  bounds forwarded to the native input and reported as `validity.tooShort`/`validity.tooLong`.
  Apply to the text-bearing types (`text`, `search`, `email`, `password`); the platform ignores
  both on `type="number"`/`type="time"`, and so does this component
- `pattern?: string` (attribute `pattern`) — a regular expression the value must match in full,
  forwarded to the native input and reported as `validity.patternMismatch`. Anchored to the whole
  value by the platform, so no `^`/`$` is needed; an empty value never violates it
- `passwordToggle: boolean = false` (attribute `password-toggle`, reflected — `type="password"`
  only) — renders the built-in show/hide-password button. **Breaking in 8.0.0: this is now opt-in.**
  Before, `type="password"` always rendered the toggle and there was no way to remove it; a consumer
  whose threat model or visual design excludes one had to hide it with CSS. Add `password-toggle`
  to keep the old rendering
- `passwordVisible: boolean = false` (attribute `password-visible` — `type="password"` only) —
  whether the field currently reveals its raw text. Toggled by the built-in button, and also
  settable up front with or without that button being rendered
- `withoutSpinButtons: boolean = false` (attribute `without-spin-buttons`, reflected —
  `type="number"` only) — suppresses the browser's own increment/decrement spin buttons.
  **Breaking in 8.0.0:** `type="number"` used to hide them unconditionally; left unset, the
  platform's spinners now render exactly as they do on a bare `<input type="number">`.
  `<lr-number-input>` defaults this the other way (`true`), so its rendering is unchanged
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

Three more native passthroughs:

- `showPicker(): void` — opens the browser's own picker for the current `type` (the time picker, and
  whatever chooser the platform offers for the other types), delegating to the internal native
  `<input>`. Deliberately failure-tolerant: the platform method throws for environmental reasons a
  component can neither detect up front nor usefully report (no user activation →
  `NotAllowedError`, a cross-origin document → `SecurityError`, a non-mutable control →
  `InvalidStateError`), and engines that predate it don't define it at all. A picker that cannot
  open is a **no-op here rather than an exception** you must wrap every call in. Also a no-op while
  `disabled` or `readonly`.
- `stepUp(steps = 1): void` / `stepDown(steps = 1): void` — increment/decrement by `steps` × the
  effective `step`, through the native `<input>`'s own `stepUp()`/`stepDown()`, so `min`/`max`
  clamping and decimal handling stay the platform's. **Silent, like the native methods**: they
  update `value`, the submitted form value and validity, but emit no `input`/`change`. A
  non-finite `steps` falls back to `1`; `0` is a no-op, as is `step="any"`, as is any `type` the
  platform gives no allowed value step (it throws `InvalidStateError` for those, which is swallowed
  here), and as is `disabled` or `readonly`. `type="number"` and `type="time"` are the two that step
  — on a time field the unit is seconds, matching its `step`.
  `<lr-number-input>`'s stepper buttons build on these and *do* emit, because a button press is a
  user edit.

**Events:** native-style composed `input` and `change`, plus `lr-input` (`detail: { value }`,
fired on every user-driven edit) and `lr-change` (`detail: { value }`, fired on the native
`change` timing), `blur`/`focus` (re-dispatched bubbling + composed from the internal native input's
own `blur`/`focus`), and `lr-clear` (no detail, fired after the clear action's `input`/`lr-input`/
`change`/`lr-change` sequence).

**Slots:** `label`, `hint`, `error`, `start` (adornment before the input), `end` (adornment after the
input and built-in actions).

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `password-toggle`
(present only when `type="password"` **and** `password-toggle` is set), `start`, `end`,
`clear-button` (non-empty clearable `text`/`search` inputs only), `hint`, `error`.

**Themeable custom properties:** `--lr-input-padding-block`, `--lr-input-padding-inline`,
`--lr-input-font-size`, `--lr-input-control-min-height` — all four auto-swapped per `size`
(`2xs`…`xl`), the same pattern
`lr-select`'s `--lr-select-trigger-padding`/`--lr-select-font-size` use.
`--lr-input-control-height` pins an **exact** outer control-row height (both floors and caps it) —
for example to pixel-match an `<lr-select>` or `<lr-combobox>` in the same toolbar row. It is
undeclared by default, leaving `--lr-input-control-min-height` as a floor only and the row free to
grow. `--lr-input-gap` (default `--lr-space-xs`, the gap inside `[part='input-wrapper']`) is
retunable without a `::part(input-wrapper)` rule and, unlike the four properties above, does not
vary by `size` — the adornment gap a text field wants between an adornment and the caret is looser
than the icon-beside-label gap the ladder is tuned for. `--lr-input-radius` (default
`--lr-form-control-radius`, its corner radius) is retunable the same way but *does* follow the tier:
the two tightest tiers take a smaller radius, since a 6px corner on a 20px-tall control reads as a
lozenge. `pill` re-assigns it to `--lr-radius-pill`. `lr-number-input`/`lr-time-input` inherit both
unchanged.

`--lr-input-fill` (default `var(--lr-color-surface)`) is the control row's background and
`--lr-input-border-color` (default `var(--lr-color-border)`) its border color. Both are swapped by
`appearance` rather than by `size`, and the documented defaults are `appearance="filled-outlined"`'s
values (they are also declared bare on `:host`, so an element whose `appearance` attribute hasn't
reflected yet still paints the committed default). Setting either directly retunes the surface
without a `::part(input-wrapper)` rule and without leaving the `appearance` vocabulary behind.

### Shared form vocabulary — `size`, `appearance`, `pill`, `setCustomValidity()`

Four things every form control in this family now spells the same way. They are documented here
because `lr-input` is where a reader meets all four at once; each component's own list restates only
what is specific to it.

- **`size` accepts both spellings of every tier.** The canonical ladder is
  `2xs`/`xs`/`s`/`m`/`l`/`xl`, and `small`/`medium`/`large` — Web Awesome's and Shoelace's names —
  are accepted as exact synonyms for `s`/`m`/`l`. Nothing is normalized away in JS: the shared
  stylesheet matches both spellings in the same selector list, so `size="small"` costs nothing and
  `el.size` reads back whatever you wrote. A migration off either upstream is a tag rename with no
  attribute rewrite. One ladder now drives `lr-button`, `lr-input`, `lr-select`, `lr-combobox`,
  `lr-date-input`, `lr-textarea`, `lr-checkbox`, `lr-radio`, `lr-switch` and `lr-slider`, so
  same-`size` controls line up in a toolbar row by construction. Retune a whole tier from one place
  with `--lr-theme-form-control-height-*` rather than per component.
- **`appearance` is the fill vocabulary and nothing else.** `accent` (the loud semantic fill),
  `filled` (a quiet tint of the same tone), `outlined` (a border, no fill), `filled-outlined`
  (both) and `plain` (neither). It used to double as a *container* treatment on other components;
  that meaning moved to `frame` (`card`/`plain`) in 8.0.0, so `appearance` means one thing
  library-wide. `lr-button` adds two tiers of its own on top (`quiet` and `link`). Text fields
  default to `filled-outlined`, `lr-select` to `outlined`, `lr-button` to `accent`.
- **`pill` rounds the control's ends.** Available on `lr-input`, `lr-number-input`, `lr-time-input`,
  `lr-textarea`, `lr-select`, `lr-combobox`, `lr-date-input`, `lr-phone-input`, `lr-token-input`,
  `lr-button` and `lr-radio-button`. In every case it does exactly one thing — re-assign that
  component's own `--lr-*-radius` knob to `--lr-radius-pill` — rather than declaring a radius on a
  part, so the knob stays the single corner-radius override point and a consumer's own value still
  wins over it.
- **`setCustomValidity(message)` is on every form-associated *value* control here** — every one
  that submits something, whether it drives `ElementInternals` through the shared mixin or by hand.
  (`lr-button` and `lr-icon-button` are form-associated so an ancestor `<fieldset disabled>` and
  `form.elements` reach them, but they carry no value or validity, so they have no such method.) It
  is the standard channel for a rejection no client-side constraint can express — a server-side
  "that email is already registered". A non-empty message raises `customError` and becomes
  `validationMessage`, so the control fails `checkValidity()`, blocks submission, and matches
  `:invalid`/`:state(invalid)`.
  `''` clears it and republishes the control's *own* computed validity rather than forcing it valid:
  a required-and-empty field goes back to `valueMissing`. The message survives every intrinsic
  recomputation and a `form.reset()`, exactly like a native control — only another
  `setCustomValidity('')` clears it — and is used verbatim, never localized, because it is
  caller-supplied content.

### Enter-to-submit

Pressing Enter in a single-line text control submits the ancestor `<form>`, the implicit submission
a native `<input>` performs. The internal input lives in a shadow root and has no form owner of its
own, so the platform can never run it here; the component does, following the platform's own rules
rather than an approximation of them:

- The keystroke must be a **bare** Enter — any of Ctrl/Cmd/Alt/Shift held makes it an application
  shortcut (send-and-keep-open, insert-newline, open-in-new-tab), never a submission.
- An Enter **during IME composition** commits the highlighted candidate; submitting there would
  throw away the word being typed, so it is skipped.
- A keydown already `defaultPrevented` by a listener above stays vetoed.
- The **submitter is resolved, not skipped**: the form's default button is the first enabled submit
  control in `form.elements`, so its `name`/`value` entry and its
  `formaction`/`formmethod`/`formnovalidate` overrides all reach the submission. A native button
  goes through `form.requestSubmit(submitter)`; an `<lr-button type="submit">` is a form-associated
  custom element, which `requestSubmit()` rejects with a `TypeError`, so it is activated through its
  own `click()` — the same path a real click takes.
- A form with **no** submit button submits implicitly only when it holds at most one field that
  blocks implicit submission, matching the platform.
- It runs through `requestSubmit()`, never `submit()`, so the `submit` event fires and interactive
  constraint validation blocks an invalid form exactly as a real submit button would. Each control
  also gates on its own `disabled`/`readonly` first.

**Deliberately not wired everywhere.** Enter means something else in several controls, and implicit
submission must never shadow it: `lr-textarea` and `lr-code-editor` insert a newline, which is the
whole point of a multi-line surface; `lr-select`'s `role="combobox"` trigger opens the listbox (and
then commits the active option), per the ARIA pattern; and `lr-date-picker` selects the focused day
in the calendar grid. The controls that *do* wire it are `lr-input` (and its `lr-number-input`/
`lr-time-input` subclasses), `lr-combobox`, `lr-date-input`, `lr-phone-input` and `lr-token-input`.

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
<lr-input type="password" label="Password" password-toggle></lr-input>
<lr-input type="email" label="Email" required></lr-input>
<lr-input size="s" placeholder="Compact"></lr-input>
<lr-input appearance="plain" pill placeholder="Pill, no chrome"></lr-input>
<lr-input type="number" min="0" max="10" step="0.5" without-spin-buttons label="Weight"></lr-input>
<lr-input type="search" clearable value="workflow" aria-label="Search"><span slot="start">⌕</span></lr-input>
<lr-input type="time" label="Reminder" id="reminder"></lr-input>
<button type="button" id="open-picker">Pick a time</button>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/input/input.js';
  const time = document.getElementById('reminder');
  // showPicker() needs user activation, so drive it from a real click.
  document.getElementById('open-picker').addEventListener('click', () => time.showPicker());
</script>
```

`password-toggle`, `pill` and `without-spin-buttons` all default to `false`, so the plain
attribute form is enough to turn each on. `autofocus` is likewise `false`-defaulting — none of
these four needs the property form to be reset.

**Known gotchas:**
- `type="email"`/`type="number"` delegate constraint validation to the internal native `<input>`'s
  own browser-computed `validity` (format/range/step), bridged into this element's own
  `ElementInternals` — not a second hand-rolled regex check. The same bridge carries
  `minlength`/`maxlength`/`pattern`, so `validity` reports the full native set: `valueMissing`,
  `typeMismatch`, `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `tooShort`, `tooLong`,
  `patternMismatch`, and `badInput`.
- **`tooShort`/`tooLong` also fire for a value assigned from script.** The native flags are raised
  only for a value the *user* edited, so the component recomputes both from its own `value` and ORs
  them in; `el.value = <over-length>` reports `tooLong` rather than silently submitting. Lengths
  count UTF-16 code units, matching the native control (one emoji counts as two). `patternMismatch`
  needs no such handling — the platform applies `pattern` to script-assigned values already.
  `validationMessage` is the browser's own localized message when the native input flagged the
  value, and the localized `valueInvalid` string when only the script-value check did.
- An empty value is never `tooShort` and never a `patternMismatch` — both native constraints skip
  the empty string, and `required` is what rejects it.
- **The `password-toggle` button is opt-in as of 8.0.0.** A bare `type="password"` now ships no
  toggle at all, and the `password-toggle` part is absent from the shadow tree with it — a
  `::part(password-toggle)` rule, or a test that queries for it, silently matches nothing until the
  attribute is set. The toggle never renders for a non-password `type`, opted in or not.
- **`type="number"` no longer hides the native spin buttons on its own.** Set
  `without-spin-buttons` (or use `<lr-number-input>`, which defaults it to `true` and draws its own
  stepper pair) to get the previous rendering back.
- `showPicker()` swallows every platform failure by design, so it returns without telling you the
  picker didn't open. Don't build a flow that assumes a picker is now on screen.
- `stepUp()`/`stepDown()` are silent — they emit no `input`/`change`. Emit your own, or drive the
  value through a real user affordance, if downstream state depends on those events.

**Additional API surface:**

- `click()` — Activates the internal input.

## `lr-number-input`

A numeric field with the complete `lr-input` form, validation and native-editing contract, plus its
own increment/decrement stepper pair. A subclass whose constructor and `connectedCallback()` both
set `type = 'number'`; apart from the two properties below, everything is `lr-input`'s surface,
unchanged.

**Properties:** `size` (`2xs`…`xl`), `appearance`, `pill`, `autofocus`, `placeholder`, `readonly`,
`label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), `autocomplete`, `spellcheck`, `autocapitalize`,
`autoCorrect` (`autocorrect`), `inputMode` (`inputmode`), `enterKeyHint` (`enterkeyhint`), and
`min`/`max`/`step` (the native numeric constraint validation), all inherited from `lr-input` with
identical meaning and identical defaults. `clearable` (and its `with-clear` spelling),
`passwordVisible` (`password-visible`), and `minlength`/`maxlength`/`pattern` are inherited but
inert — see gotchas.

Two properties are this component's own:

- `steppers: boolean = true` (attribute `steppers`, reflected) — renders the increment/decrement
  pair inside the control row. It **defaults to `true`**, so it needs a custom converter to switch
  off: write `steppers="false"` as an attribute, or `.steppers=${false}` as a property binding.
  A bare `?steppers=${false}` (or removing the attribute in a framework that models booleans by
  presence) cannot reset a `true`-defaulting property.
- `withoutSpinButtons: boolean = true` (attribute `without-spin-buttons`, reflected) — the same
  knob `lr-input` exposes, but **defaulted the other way here** (`lr-input`'s default is `false`),
  so the component's own steppers are never shown alongside the browser's built-in spin buttons.
  It is `true`-defaulting too, so `without-spin-buttons="false"` / `.withoutSpinButtons=${false}`
  brings the native pair back. The two properties are independent: `steppers="false"
  without-spin-buttons="false"` returns the field to a plain native `<input type="number">`.

Each stepper drives the inherited `stepUp()`/`stepDown()`, so `min`/`max` clamping and decimal
handling stay the platform's. Unlike those silent methods, a stepper **click** is a user edit and
emits the same `input`/`lr-input`/`change`/`lr-change` sequence typing would — but only when the
value actually moved, so clicking at a bound is inert rather than emitting a no-op edit. Clicking
also returns focus to the field.

The steppers are deliberately outside the tab order (`tabindex="-1"`), like the native spin buttons
they stand in for: a keyboard user steps the value with ArrowUp/ArrowDown on the field itself, which
the native `<input type="number">` already handles, so making them tab stops would add two stops per
field for no new capability. Each carries a localized accessible name and the shared
`--lr-icon-button-size` hit-area floor in both axes, and both are disabled while the field is
`disabled` or `readonly`.

**Events:** `input`/`change` (native-style, composed), `lr-input`/`lr-change`
(`detail: { value }`), `focus`/`blur` (re-dispatched bubbling + composed from the internal native
input), and `lr-clear` (inherited, never fired here).

**Slots:** `label`, `hint`, `error`, `start`, `end`.

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `input`, `stepper-down` and
`stepper-up` (the two stepper buttons, rendered only while `steppers` is set; they sit side by side
between the built-in clear/password actions and the `end` adornment, and each one rotates the shared
chevron glyph — `[part="stepper-up"] > svg` a quarter turn one way, `[part="stepper-down"] > svg` the
other — so a consumer replacing the button chrome keeps the same up/down orientation), `start`, `end`,
`hint`, `error`, plus the inherited `clear-button` and `password-toggle`, neither of which this
component ever renders.

**Themeable custom properties:** inherited from `lr-input`, identical in meaning —
`--lr-input-control-min-height`, `--lr-input-control-height`, `--lr-input-padding-block`,
`--lr-input-padding-inline`, `--lr-input-font-size`, `--lr-input-gap`, `--lr-input-radius`,
`--lr-input-fill`, and `--lr-input-border-color` (all
but `--lr-input-control-height` and `--lr-input-gap` follow the active `size` tier;
`--lr-input-control-height` stays undeclared until you pin an exact
row height, `--lr-input-fill`/`--lr-input-border-color` swap per `appearance` instead of per tier,
and `--lr-input-gap` — like `--lr-button-gap` — is constant across the ladder). The steppers take their font size from `--lr-input-font-size` and their
minimum box from `--lr-icon-button-size`.

```html
<lr-number-input label="Quantity" min="0" max="99" step="1" value="1"></lr-number-input>
<!-- A bare numeric field: no steppers, and the browser's own spinners back: -->
<lr-number-input label="Quantity" steppers="false" without-spin-buttons="false"></lr-number-input>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/input/number-input.js';
</script>
```

**Known gotchas:**
- **`steppers` and `without-spin-buttons` both default to `true` here.** Only the literal string
  `"false"` parses as `false`; every other attribute value — including an empty one, and including
  *removing* the attribute — parses as `true`. So `?attr=${false}` and a removed attribute cannot
  reset either; use the `="false"` attribute value or the `.prop=${false}` property binding. The
  two also serialize differently when reflected: `steppers` is absent while `true` and appears as
  `steppers="false"` while `false`, whereas `without-spin-buttons` appears empty while `true` and is
  absent while `false`. Assert the rendered result, not the attribute's presence.
- `clearable`/`clear-button`/`lr-clear` are inert: the clear action only renders for
  `type="text"`/`"search"`. `password-visible`/`password-toggle` are likewise inert, since the
  toggle only renders for `type="password"`. `minlength`/`maxlength`/`pattern` are inert too — the
  platform ignores all three on `type="number"`; use `min`/`max`/`step` instead.
- `type` is re-forced to `number` on every connect, but a later `el.type = 'text'` on a connected
  element is not reverted — use `lr-input` when the type has to change.

## `lr-time-input`

A migration-friendly time alias of `lr-input` — the same subclassing shape as `lr-number-input`,
with the constructor and `connectedCallback()` setting `type = 'time'`. Its only own API is a
re-typed `min`/`max` pair (below); every other property, event, slot and part is `lr-input`'s.

**Properties:** `size` (`2xs`…`xl`), `appearance`, `pill`, `autofocus`, `placeholder`, `readonly`,
`label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), `autocomplete`, `spellcheck`, `autocapitalize`,
`autoCorrect` (`autocorrect`), `inputMode` (`inputmode`), and `enterKeyHint` (`enterkeyhint`) — all
inherited from `lr-input` with identical meaning and identical defaults (`appearance` is
`'filled-outlined'`, `pill` and `autofocus` are `false`).
`clearable` (and its `with-clear` spelling), `passwordVisible` (`password-visible`),
`withoutSpinButtons` (`without-spin-buttons`), and `minlength`/`maxlength`/`pattern` are
inherited but inert, exactly as on `lr-number-input` — the platform ignores all three length/pattern
constraints on `type="time"` as well, and there are no spin buttons on a time field to suppress.
Unlike `lr-number-input`, this component does **not** flip `without-spin-buttons`' default: it stays
`false`, and there are no `steppers` here.

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
`--lr-input-padding-inline`, `--lr-input-font-size`, `--lr-input-gap`, `--lr-input-radius`,
`--lr-input-fill`, and `--lr-input-border-color` (all
but `--lr-input-control-height` and `--lr-input-gap` follow the active `size` tier;
`--lr-input-control-height` stays undeclared until you pin an exact
row height, `--lr-input-fill`/`--lr-input-border-color` swap per `appearance` instead of per tier,
and `--lr-input-gap` — like `--lr-button-gap` — is constant across the ladder).

`showPicker()` (inherited) is the supported way to open the browser's own time picker
programmatically; it is a no-op without user activation, while `disabled`, while `readonly`, and in
engines that don't implement it, rather than throwing.

`stepUp(steps = 1)` / `stepDown(steps = 1)` (inherited) do work here — a native time input has an
allowed value step, so they move the value by `steps` × `step` **seconds** with the platform's own
`min`/`max` clamping. Like on `lr-input` they are **silent**: `value`, the submitted form value and
validity all update, but no `input`/`change` is emitted. `step="any"`, `disabled` and `readonly`
each make them no-ops.

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
- `size: LyraSize = 'm'` (reflected — the shared control ladder, so both `2xs`/`xs`/`s`/`m`/`l`/`xl`
  and `small`/`medium`/`large` are accepted; scales input padding, font size, and wrapper
  min-height; `size="s"` shares its outer control height with `lr-input`, `lr-select`, and
  `lr-combobox` without part overrides)
- `pill: boolean = false` (reflected) — rounds the field's corners to a full pill, mirroring
  `lr-input`'s own `pill`. It re-assigns `--lr-phone-input-radius` to `--lr-radius-pill`, and the
  country trigger's leading corners follow, since both read that one knob
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
- `incompleteText: string = 'This phone number is incomplete.'` (attribute `incomplete-text`) —
  validation message for dial-like input that can still become valid with more digits. The
  untouched default routes through the localized `phoneInputIncomplete` message.
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

**Additional API surface:**

- `click()` — Activate the internal telephone input unless the form control is effectively disabled.
- `--lr-phone-input-flag-size` — Selected flag size, scaled by `size`.
- `--lr-phone-input-glyph-size` — Country selector glyph size, scaled by `size`.
- `--lr-phone-input-gap` — Country-trigger child gap. Default: `var(--lr-space-xs)`.
- `--lr-phone-input-radius` — Input-wrapper corner radius. Default: `var(--lr-radius)`.
- `--lr-phone-input-focus-border-color` — Focused row border color. Default: `var(--lr-color-brand)`.
- `--lr-phone-input-invalid-border-color` — Invalid row border color. Default: `var(--lr-color-danger)`.
- `--lr-phone-input-country-hover-bg` — Country trigger hover background. Default: `var(--lr-color-brand-quiet)`.

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
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — visual size; proportionally
  scales the handle, track, and preset buttons via a single `--lr-time-range-size-scale` multiplier
  (not pixel-matched to `lr-input`'s row-height scale — this component's own dimensions aren't on
  that ladder); the drag hit-area never shrinks below 24px (WCAG 2.5.8)
- `disabled: boolean = false` (reflected)
- `startLabel: string = 'Range start'` (attribute `start-label`) — `aria-label` for the start handle
- `endLabel: string = 'Range end'` (attribute `end-label`) — `aria-label` for the end handle
- `valueFormatter?: TimeRangeValueFormatter` (attribute: false) — maps each finite, clamped
  `aria-valuenow` to optional human-readable `aria-valuetext`; called as
  `(value, handle: TimeRangeHandle)`, where `TimeRangeHandle = 'start' | 'end'`. The formatter may
  return `string | null | undefined`; a nullish result omits `aria-valuetext` for that handle.
  Leaving the property unset preserves the numeric-only contract
- `presets: TimeRangePreset[] = []` (attribute: false) — `TimeRangePreset { label: string; start:
  number; end: number }`; optional discrete presets (e.g. "Last 7 days") rendered as a
  `[part="presets"]` button row above the track — purely additive, the continuous brush is
  unaffected and both interaction modes coexist; picking one sets both handles and emits the same
  `lr-input`/`lr-change` pair a committed drag or keyboard step would

**Events:** `lr-input` (fired continuously while dragging or on each arrow/Home/End/PageUp/
PageDown key press, `detail: { start, end }`), `lr-change` (fired on pointer release /
key-up-commit, or when a preset button is clicked, `detail: { start, end }`)

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to `[part="handle-start"]`. A
two-handle control has no single canonical target, so the start handle is the one they address —
call `.focus()` on `::part(handle-end)` yourself if you need the other. Without these overrides the
host's own `focus()`/`blur()`/`click()` are no-ops, because the real control lives in the shadow
root.

`setCustomValidity(message)` is this control's **only** validation channel: every reachable range is
intrinsically legal, so there is no constraint for it to compute. A non-empty message raises
`customError`, becomes `validationMessage`, and blocks submission of the form it sits in; `''`
clears it. The error survives handle moves, preset picks and a form reset, exactly like a native
control — so a consumer re-validating a range on every `lr-input` calls this with the new message
(or `''`) each time rather than expecting the movement itself to clear it. The message is
caller-supplied and is used verbatim, never localized.

**Slots:** none.

**CSS parts:** `base`, `track`, `range`, `handle-start`, `handle-end`, `presets`, `preset-button`

**Themeable custom properties:** mostly shared tokens — `--lr-color-border`, `--lr-color-brand`,
`--lr-color-surface`, `--lr-shadow` (track/handles), `--lr-opacity-disabled` (`:host(:disabled)`
dimming, including ancestor-fieldset disablement), plus (for `presets`) `--lr-color-text`,
`--lr-color-on-brand` (the active preset
button's text), `--lr-radius`, `--lr-space-xs/-s`, `--lr-transition-fast`,
`--lr-focus-ring-*`.

Three component-local properties recolor the **active** preset button independently of the shared
palette: `--lr-time-range-preset-active-bg` (falls back to `--lr-color-brand`),
`--lr-time-range-preset-active-border-color` (falls back to `--lr-color-brand`), and
`--lr-time-range-preset-active-color` (falls back to `--lr-color-on-brand`). Unset, each resolves
to exactly the token the rule used before they existed, so the default rendering is unchanged.

One additional component-local property, `--lr-time-range-size-scale` (unitless multiplier,
default 1, automatically set based on the `size` property), scales the handle, track, and preset
button dimensions proportionally — unset, it defaults to 1 (size='m', no scaling).

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
<lr-time-range id="months" min="0" max="2" start="0" end="2"></lr-time-range>
<script>
  const months = ['April 2023', 'May 2023', 'June 2023'];
  const range = document.getElementById('months');
  range.valueFormatter = (value, handle) =>
    `${handle === 'start' ? 'From' : 'Through'} ${months[value]}`;
  range.addEventListener('lr-change', (e) => console.log(e.detail.start, e.detail.end));
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
- `valueFormatter` is presentation-only: `aria-valuenow`, geometry, emitted values, and preset
  matching stay numeric. Non-finite handles omit both `aria-valuenow` and `aria-valuetext` and are
  never passed to the formatter.
- Handles a `min > max` domain, a non-positive/non-finite `step`, and disabled-mid-drag/
  disconnect-mid-drag correctly (tested) — safe to rely on those edge cases. Concurrent drags are
  tracked per `pointerId` (not a single scalar), so a two-finger touch — one finger per handle —
  moves both independently instead of the second pointer hijacking which handle the first pointer's
  moves apply to; `pointercancel`/`lostpointercapture` (not just `pointerup`) both end a drag, same
  fix as `lr-split`.
- Non-finite domain/handle values use finite fallback geometry, and non-finite or negative steps are
  treated as unstepped; invalid values never become `NaN`/`Infinity` CSS or ARIA strings.
- `startLabel`/`endLabel` only override each handle's `aria-label`; they don't affect
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, `valueFormatter`, or any visible text.
- An ancestor `<fieldset disabled>` toggling is reflected via `formDisabledCallback` into
  `effectiveDisabled` (tracked separately from the consumer's own `disabled`), so re-enabling the
  fieldset correctly restores a handle that had `disabled` set explicitly by the consumer, and vice
  versa — mirrors `lr-combobox`'s identical pattern.

**Additional API surface:**

- `--lr-time-range-handle-size` — Visible handle diameter. Default: `14px*scale`.
- `--lr-time-range-hit-size` — Actual drag hit-area diameter; endpoint handles are inset by half this distance so the hit geometry stays inside the host. Default: `max(24px,28px*scale)`.
- `--lr-time-range-track-size` — Track and selected-range thickness. Default: `4px*scale`.
- `--lr-time-range-base-size` — Brush baseline block size. Default: `1.5rem*scale`.
- `--lr-time-range-preset-gap` — Gap between preset buttons. Default: `var(--lr-space-xs)`.
- `--lr-time-range-preset-radius` — Preset button corner radius. Default: `var(--lr-radius)`.
- `--lr-time-range-preset-padding` — Preset button padding, scaled by `size`.
- `--lr-time-range-preset-font-size` — Preset button font size, scaled by `size`.

---

## `lr-swatch-picker`

A single-select picker over a small, fixed set of color swatches with the WAI-ARIA APG
`radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic
activation (click or arrow-key move both select immediately, like a native radio group), cyclic
Arrow/Home/End navigation. First-party invention (no Web Awesome equivalent). Distinct from
`lr-color-picker`, which is a freeform picker over the whole colour space — this picks exactly one
of N designer-chosen named colors, the shape apps otherwise hand-roll as a row of round
accent-color buttons. Its `options` are the *only* choices; a `lr-color-picker`'s `swatches` are a
shortcut list alongside a grid, a hue ramp and a text field that can still express any colour.

**Properties:**
- `options: SwatchOption[] = []` (attribute: false) — `SwatchOption { value: string; color: string;
  label: string; icon?: unknown; gemstone?: GemstoneKey }`; a valid CSS `color` is used as the
  swatch fill, while invalid values, declaration-breaking input, and `url()` are ignored (and are
  never interpolated into a gemstone SVG). `label` is each swatch's accessible name and `title`.
  `icon` is an optional custom shape rendered *instead of* the plain filled circle; `gemstone`
  selects the canonical faceted glyph when `mode="gemstone"`. An explicit `icon` wins over
  `gemstone`.
- `value: string | null = null` — the currently selected option's `value` (controlled); `null`
  leaves nothing selected while keeping the first swatch tabbable.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — scales the swatch hit-area and
  fill diameter proportionally, hit-area floored at 24px; not pixel-matched to `lr-input`'s
  row-height scale)
- `mode: 'swatch' | 'gemstone' = 'swatch'` (reflected) — `swatch` preserves the plain-circle
  default. `gemstone` renders the shared glyph for options carrying a `gemstone` key and enables
  the selected glow/shine defaults.
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
place when it has one, with its inherited `font-size` set to the same fill-size token so a `1em`
glyph fills the wrapper). Exactly one of `swatch-fill`/`swatch-icon` is mounted per swatch, so the
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
per `size` tier), `--lr-swatch-picker-gemstone-selected-blur` (default `--lr-size-0-5rem` in
gemstone mode), `--lr-swatch-picker-gemstone-shine-duration` (default `1.8s` in gemstone mode);
plus shared tokens — `--lr-color-border`/`-brand`, `--lr-space-xs`,
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

For the shared gemstone accent mode, import the Lit-free palette data entry. The glyph renderer
remains available separately from `theme/gemstones.js` for Lit templates; palette-only consumers
do not need to load Lit. The consumer still owns localized labels, display order, and the initial
value:

```ts
import '@aceshooting/lyra-ui/components/forms/swatch-picker/swatch-picker.js';
import { GEMSTONES } from '@aceshooting/lyra-ui/theme/gemstones-data.js';

const order = ['emerald', 'ruby', 'sapphire', 'hematite'] as const;
picker.mode = 'gemstone';
picker.options = order.map((key) => ({
  value: key,
  color: GEMSTONES[key].fill,
  label: translateGemstone(key),
  gemstone: key,
}));
picker.value = 'ruby';
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

**Additional API surface:**

- `--lr-swatch-picker-gap` — Gap between swatches. Default: `var(--lr-space-xs)`.

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
- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the box and its checkmark off
  the same values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a
  row. The slotted label keeps the library's standard control-label type size at every tier —
  restyle it through `::part(label)` if you want it to track the control.

**Events:** user toggles emit bubbling/composed `input`, then `change`, then the compatibility
`lr-change` alias (`detail: { checked: boolean }`). Programmatic `.checked` assignments are
silent. Internal `focus`/`blur` are re-dispatched as bubbling, composed host events.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal checkbox control.
`setCustomValidity(message)` sets or clears a consumer-supplied error ("those terms have been
superseded"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unchecked box goes back to `valueMissing`. It
survives every toggle and a form reset; only another `setCustomValidity('')` clears it.

**Slots:** default — label text, rendered next to the box. Clicking it toggles the checkbox, the
same as clicking a native checkbox's associated `<label>`. If left empty, set `aria-label` on the
host so the control still has an accessible name.

Host `aria-describedby` targets in the host's own root are resolved onto the internal
`role="checkbox"` through `ariaDescribedByElements`, so an externally-owned description remains
valid across the shadow boundary. In supporting browsers the explicit element list intentionally
leaves the internal role's serialized attribute empty; browsers without the reflected-reference
API keep the string fallback. The relationship tracks host attribute changes and clears when
unset.

**CSS parts:** `base` (the whole interactive control, `role="checkbox"`), `box` (the small square
showing the checkmark/indeterminate dash), `checkmark` (the checkmark or indeterminate-dash glyph),
`label` (wrapper around the default slot)

**Themeable custom properties:** `--lr-checkbox-box-size` and `--lr-checkbox-label-indent` (both
below), plus shared tokens — `--lr-space-s`, `--lr-icon-button-size`,
`--lr-color-border/-surface/-on-brand/-brand/-text/-danger`, `--lr-radius`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**`--lr-checkbox-box-size`** — the edge length of `[part='box']`, defaulting to
`min(var(--lr-icon-button-size), calc(var(--lr-form-control-height) * 0.7))`. Derived from the
active `size` tier's shared control height, so the box lines up with an
`lr-input`/`lr-select`/`lr-button` of the same `size` instead of carrying a scale of its own; at the
default `m` tier it resolves to `1.75rem`, exactly what the control shipped with before it had a
`size` at all. The `--lr-icon-button-size` cap is kept, so a consumer compacting that theme token
compacts this control with it. Set it to pin the box independently of the tier.

**`--lr-checkbox-label-indent`** — the inline distance from the control's start edge to the start of
the label text: the box plus the gap beside it. It defaults to
`calc(var(--lr-checkbox-box-size) + var(--lr-space-s))`, and the rendered gap is
*derived* from it, so the advertised value and the real label offset cannot drift. Setting it on
the element (or on `lr-checkbox` in your own stylesheet) moves the label.

It is published so you can align your own per-option hint text under the label without re-deriving
that formula by reading the shadow styles. **But custom properties inherit down, not sideways**, so
a *sibling* node in your tree cannot read it off the checkbox. Align a sibling by computing the
same formula from the `--lr-theme-*` inputs you control — the tier below is the default `m`;
substitute the one you actually use:

```css
.checkbox-hint {
  padding-inline-start: calc(
    min(
      var(--lr-theme-icon-button-size, 2.5rem),
      calc(var(--lr-theme-form-control-height-m, 2.5rem) * 0.7)
    ) + var(--lr-theme-space-s, 0.5rem)
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
- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the track and thumb off the
  same values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a row.
  The slotted label keeps the library's standard control-label type size at every tier — restyle it
  through `::part(label)` if you want it to track the control.

**Events:** a user toggle (click, Space/Enter, or the programmatic `click()` activation path) emits
`input`, then `change`, then `lr-change` (`detail: { checked: boolean }`) — in that order, matching
the native checkbox/radio contract. The two native-style events are **new in 8.0.0**: a boolean
control that emitted only the `lr-`-prefixed alias was invisible to every form library, validation
helper, and `<form>`-level `change` listener that binds the native names, which is the ordinary way
a consumer observes a control they didn't write. Both bubble and compose, and neither carries a
detail — read `event.target.checked`. None of the three fires for a programmatic `.checked`
assignment, `form.reset()`, or session-state restoration. The internal control's native
`focus` and `blur` are re-dispatched as bubbling, composed host events.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal switch control.
`setCustomValidity(message)` sets or clears a consumer-supplied error ("notifications are disabled
for your plan"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unchecked switch goes back to `valueMissing`. It
survives every toggle and a form reset; only another `setCustomValidity('')` clears it.

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

**Themeable custom properties:** `--lr-switch-track-block-size` (default
`calc(var(--lr-form-control-height) * 0.5)`), `--lr-switch-track-inline-size` (default
`calc(var(--lr-switch-track-block-size) * 1.8)`, the 1.8:1 aspect ratio the control has always had)
and `--lr-switch-thumb-offset` (default `var(--lr-size-2px)`) — component-local geometry knobs set
on `:host`, since a fully-rounded pill/thumb needs a radius well past the shared `--lr-radius`
default. Both track dimensions ride the shared `size` ladder, so at the default `m` tier they
resolve to exactly the `1.25rem` × `2.25rem` the switch shipped with before it had a `size` at all.

`--lr-switch-track-fill` (default `--lr-color-border`) is `[part='track']`'s resting fill,
re-pointed at `--lr-color-brand` while `checked`. Hover and press are colour **mixes** away from
whichever of the two is current — `--lr-color-mix-partner` at the `--lr-color-mix-hover` and
`--lr-color-mix-active` shares — so retinting this one property retints all four renderings at
once, and neither state touches the label text beside the track. Plus shared tokens
`--lr-space-s`, `--lr-color-border/-brand/-surface/-text`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-switch name="notifications" checked>Enable notifications</lr-switch>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/switch/switch.js';
  const sw = document.querySelector('lr-switch');
  sw.addEventListener('lr-change', (e) => console.log(e.detail.checked)); // prefixed alias
  sw.addEventListener('change', (e) => console.log(e.target.checked));    // native-style, no detail
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
seamlessly right after. Mirrors the core `<wa-slider>` API under the `lr-` prefix.

**Two-handle `range` mode.** `range` turns the control into a selection between `minValue` and
`maxValue`. Each handle is a separately focusable `role="slider"` with its own localized accessible
name, and each reports the *reachable* sub-range through `aria-valuemin`/`aria-valuemax` — bounded
by its sibling rather than by the full domain, because the handles may meet but never cross. When
they meet, both report the same number, the indicator has zero length, and each handle can still
travel away from the meeting point in its own direction. A track click moves whichever handle is
nearer the clicked position. `[part="base"]` then carries `role="group"`, named from
`label`/`aria-label`, so the pair is announced as one control.

A range slider **does not submit a value**: two numbers cannot be expressed through the
single-string `FormAssociated` contract, so while `range` is set the control removes itself from its
form's `FormData` entirely (matching `<lr-time-range>`) rather than submitting a value it isn't
showing. Read `minValue`/`maxValue`, or the event detail. Turning `range` back off restores normal
single-value submission.

**Properties:**
- `min: number = 0`
- `max: number = 100`
- `step: number = 1` — a zero or negative value is kept as an explicit "unstepped" mode
- `range: boolean = false` (reflected) — two-handle mode; see above
- `minValue: number` (attribute `min-value`) — the lower handle's value in `range` mode. Unset, it
  resolves to `min`, so an untouched range slider selects its whole domain whatever `min`/`max`
  happen to be. Assigning past `maxValue` stops at `maxValue`
- `maxValue: number` (attribute `max-value`) — the upper handle's value. Unset, it resolves to
  `max`; assigning below `minValue` stops at `minValue`. Only the `min-value`/`max-value`
  *attributes* are captured as the `form.reset()` defaults, so a later property assignment never
  redefines what a reset restores to
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — which axis carries the
  value. `'horizontal'` maps values to the inline axis (mirroring under RTL); `'vertical'` maps them
  to the block axis with the domain minimum at the block **end** (so "up" always means "more"),
  switches the primary keys to ArrowUp/ArrowDown, and exposes `aria-orientation="vertical"` on every
  handle
- `readonly: boolean = false` (reflected) — the value is displayed but not changeable. Unlike
  `disabled`, a read-only slider stays focusable, fully legible, and **still submits its value**; it
  renders `aria-readonly` in both states and withdraws the grab cursor
- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the track, the filled
  indicator, the tick marks and the handles off the same values `lr-input`/`lr-select`/`lr-button`
  read, so controls of one `size` line up in a row. The handle's transparent drag area keeps its own
  1.75rem/28px floor at every tier, so a small slider is still a conformant pointer target
- `withMarkers: boolean = false` (attribute `with-markers`, reflected) — draws a tick mark at every
  `step` position along the track. Purely decorative (`aria-hidden`). Nothing is drawn for an
  unstepped grid (`step` ≤ 0) or for one implying more than 100 intervals — ten million ticks would
  be visually indistinguishable and would hang the page, so the grid is dropped rather than
  half-drawn
- `withTooltip: boolean = false` (attribute `with-tooltip`, reflected) — shows a live value bubble
  above each handle while that handle is focused or being dragged. Its text is `valueFormatter`'s
  result when one is supplied, otherwise the locale-formatted number
- `hint: string = ''` — plain-text description of what the slider controls, rendered below the track
  and wired to every handle through `aria-describedby`. Use the `hint` slot for rich content.
  Deliberately the only visible-chrome property here: there is no visible label or error surface (a
  labeled-field consumer wraps this element in their own layout), but a slider's units frequently
  need a written explanation with nowhere else to live
- `label: string = ''` — accessible name set as `aria-label` on the `role="slider"` thumb (or on the
  `role="group"` wrapping both range handles, since each handle then owns its own start/end name); a
  plain `aria-label` attribute on the host itself wins over it, and with neither set the localized
  generic `sliderLabel` message applies so the focusable thumb is never nameless.
- `valueFormatter?: SliderValueFormatter` (attribute: false) —
  `(value: number, handle: 'value' | 'min' | 'max') => string | null | undefined`. Maps the finite,
  clamped `aria-valuenow` number to optional human-readable `aria-valuetext`, and supplies the
  `with-tooltip` bubble's text. The second argument identifies which handle is being formatted
  (`'value'` on a single-handle slider). A nullish result omits `aria-valuetext`. Leaving the
  property unset preserves the numeric `aria-valuetext`.
- `showValue: boolean = true` (attribute `show-value`) — whether to render the current numeric value as
  visible text next to the track. In `range` mode the readout is both handle values joined by an en
  dash. Not reflected, and `true`-defaulting: toggle it off via the `.showValue=${false}` property
  binding or a plain `show-value="false"` content attribute — `?show-value=${false}` and a removed
  attribute both leave it `true`.
- Inherited from `FormAssociated`: `name: string = ''`, `value: string` (form-submitted string form),
  `disabled: boolean = false` (reflected), `required: boolean = false` (reflected).

**Accessor:** `valueAsNumber: number` — get/set. Reading always returns a finite, clamped, step-snapped
number, even if `value` is momentarily `""` (e.g. right after `form.reset()`, before the mount-time
default reseeds it), by falling back to the midpoint of `[min, max]`. Writing clamps/snaps the input and
stringifies the result back into `value`.

**Events:** `lr-input` — fired continuously during an active drag or a
keyboard step, including OS key-repeat while a key is held, mirroring native `<input type=range>`'s
own `input` event — and `lr-change`, fired once an interaction commits: on
pointerup for a drag, or on keyup for a keyboard step, so a single Arrow/Home/End/PageUp/PageDown press
fires both, mirroring native `<input type=range>`'s own `change`-on-every-committed-step behavior.
**Breaking in 8.0.0:** both details widened from `{ value: number }` to
`{ value: number; minValue: number; maxValue: number; handle: 'value' | 'min' | 'max' }`. `value` is
the value of the handle that moved and `handle` says which one that was (`'value'` on a
single-handle slider); `minValue`/`maxValue` always carry both range-handle positions. Existing
`e.detail.value` readers keep working unchanged.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal `[part="thumb"]`
control — without them the host's own `focus()`/`blur()`/`click()` would be no-ops, because the
`role="slider"` element they need to reach lives in the shadow root. In `range` mode all three
target the **lower** handle.

**Slots:** `hint` — rich hint content, replacing the plain-text `hint` property. The hint region is
hidden and contributes no `aria-describedby` while neither the property nor the slot has content.

**CSS parts:** `base` (row wrapping the track and optional value readout; carries `role="group"` in
`range` mode), `track` (the full-length background line), `indicator` (the filled portion of the
track: from `min` up to the current value, or between the two handles in `range` mode),
`markers` (the tick container, present only with `with-markers`) and `marker` (one `step`-grid
tick), `thumb` (a draggable handle, `role="slider"` — present on every handle including both range
ones), `thumb-min` and `thumb-max` (the lower and upper range handles; each carries `thumb` as
well, so `::part(thumb)` styles both while `::part(thumb-min)` reaches only one), `tooltip` (the
live value bubble per handle, present only with `with-tooltip`), `tooltip-visible` (added *to the
`tooltip` element's part list* while that handle is focused or dragged — visibility is encoded in
the part name because `::part(tooltip)[data-visible]` is invalid CSS and never matches; write
`::part(tooltip-visible)`), `value` (numeric readout, shown when `show-value` is true), `hint` (the
hint region).

**Breaking in 8.0.0:** the `fill` part was **renamed to `indicator`**, matching `wa-slider`. A
`::part(fill)` rule silently matches nothing now — rename it.

**Themeable custom properties:** three geometry knobs ride the shared `size` ladder, so a tier moves
them all without a per-tier rule, and the values in brackets are what they resolve to at the default
`m`:

- `--lr-slider-thumb-size` (default `calc(var(--lr-form-control-height) * 0.4)`; `1rem`) — the
  diameter of each draggable handle. The transparent drag area around it never drops below
  1.75rem/28px whatever this is set to, so shrinking the visible dot cannot cost you the pointer
  target.
- `--lr-slider-track-thickness` (default `calc(var(--lr-slider-thumb-size) * 0.25)`; `0.25rem`) —
  the thickness of the track, the filled `indicator`, and (scaled from it) the `with-markers` ticks.
- `--lr-slider-row-size` (default `calc(var(--lr-form-control-height) * 0.6)`; `1.5rem`) — the
  cross-axis extent of `[part="base"]`: its block size when horizontal, its inline size when
  vertical.

`--lr-slider-track-length` (default `var(--lr-size-10rem)`) is the
track's length in `orientation="vertical"`; a horizontal track fills its container instead, so the
token is inert there. It is declared as an inline `var()` fallback and never on `:host`, so a
consumer value set on any ancestor is never shadowed. Everything else is shared tokens —
`--lr-space-s`, `--lr-color-border/-brand/-surface/-text-quiet`, `--lr-shadow`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-slider
  name="temperature"
  min="0"
  max="2"
  step="0.1"
  label="Temperature"
  hint="Higher values make replies more varied."
  with-markers
  with-tooltip
  .valueAsNumber=${0.7}
  .valueFormatter=${(value, handle) => `${value * 100}%`}
  @lr-input=${(e) => setDraftTemperature(e.detail.value)}
  @lr-change=${(e) => commitTemperature(e.detail.value)}
></lr-slider>

<!-- Two handles, vertical. Range mode submits nothing: read minValue/maxValue. -->
<lr-slider
  range
  orientation="vertical"
  min="0"
  max="1000"
  step="50"
  min-value="200"
  max-value="800"
  label="Price"
  @lr-change=${(e) => applyPriceFilter(e.detail.minValue, e.detail.maxValue)}
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
- `valueFormatter` is presentation-only: `aria-valuenow`, the visible numeric readout, geometry,
  form value, and emitted values stay numeric. With no formatter, `aria-valuetext` remains the
  numeric string rendered by earlier versions; a nullish formatter result omits it.
- A pointer drag fires `lr-input` continuously and a single `lr-change` on release; a keyboard step
  fires exactly one of each per press, but OS key-repeat while a key is held re-fires `lr-input` on
  every repeat while still only committing `lr-change` once, on the eventual keyup. A gesture that
  ends without a pointerup (`pointercancel`, lost pointer capture, the element being removed
  mid-drag) tears down cleanly and commits nothing.
- **`::part(fill)` no longer matches** — the part is `indicator` as of 8.0.0.
- **A `range` slider contributes no form entry.** `new FormData(form)` simply has no key for it, and
  `value`/`valueAsNumber` keep tracking the single-handle value that isn't being shown. Read
  `minValue`/`maxValue`.
- `min-value`/`max-value` are clamped against the domain, snapped to `step`, and re-sanitized once
  every declarative attribute has landed, so narrowing `min`/`max` after mount can silently move
  both handles. Only the attributes seed the `form.reset()` defaults.
- Vertical sliders put the domain minimum at the block **end**: ArrowUp increases. ArrowUp/ArrowDown
  are never mirrored under RTL, which is exactly what makes them the stable primary keys there.
- `with-markers` silently draws nothing when `step` is 0/negative or when the domain implies more
  than 100 intervals. That is a deliberate ceiling, not a bug — check the rendered `[part="marker"]`
  count rather than assuming the ticks are there.
- The visible thumb is deliberately below the library's usual 40px icon-button floor — 16px at the
  default `m` tier, and smaller at the tighter ones. A transparent `::before` carries the hit/drag
  area at `max(28px, calc(var(--lr-slider-thumb-size) * 1.75))`, which clears WCAG 2.5.8's 24px
  minimum at **every** tier, while a 40px *visible* thumb would make two range handles overlap
  across 40px of track and hijack track clicks. The pseudo-element has no DOM node of its own, so a
  pointerdown inside it still reports the thumb as `e.target`.

---

## `lr-radio`

A form-associated single-choice control. Use it alone or inside `lr-radio-group`.

**Properties:** `checked`, `disabled`, `required`, `name`, and `value` (all reflected where
applicable). A selected radio submits its value through `ElementInternals`.
An empty `name` is canonicalized to an omitted attribute rather than reappearing as `name=""`.
`effectiveRequired` exposes the required state inherited from a containing radio group. `focus()`,
`blur()`, and `click()` forward to the internal radio control.

- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the indicator off the same
  values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a row. The
  slotted label keeps the standard control-label type size at every tier — restyle it through
  `::part(label)` to make it track the control.
- `pill: boolean = false` (reflected) — rounds the control's own chrome into a pill instead of the
  shared control radius. A plain `<lr-radio>`'s indicator is a circle at every setting, so this is
  visible on `<lr-radio-button>`, which inherits this class and renders rectangular chrome; it is
  declared here so both tags carry one property with one meaning.

`setCustomValidity(message)` sets or clears a consumer-supplied error ("that plan is no longer
available"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unselected radio goes back to `valueMissing`. It
survives every selection, every group-driven `required` change, and a form reset. It lives on the
radio rather than on `<lr-radio-group>` because the group is not itself form-associated — it
designates one member as the group's validity owner, and that radio is what participates in the
owning form.

**Events:** native-style composed `input` and `change`. A standalone radio also emits `lr-change`
with `{ checked, value }`. An owned radio suppresses that child alias at its source; its group emits
the sole aggregate `lr-change` described below, so capture and bubble listeners cannot observe two
differently shaped aliases. The internal control's native `focus` and `blur` are re-dispatched as
bubbling, composed host events.

**Slots:** default label content.

**CSS parts:** `base`, `circle`, `dot`, `label`.

**Themeable custom properties:**

- `--lr-radio-circle-size` (default `min(var(--lr-icon-button-size), calc(var(--lr-form-control-height)
  * 0.7))`; `1.75rem` at the default `m` tier) — the edge length of `[part='circle']`, derived from
  the active `size` tier's shared control height so a radio lines up with an
  `lr-input`/`lr-select`/`lr-button` of the same `size`.
- `--lr-radio-dot-size` (default `min(calc(var(--lr-radio-circle-size) * 0.5),
  calc(var(--lr-form-control-height) * 0.3))`; `0.75rem` at `m`) — the edge length of `[part='dot']`,
  capped at half the circle so it can never outgrow its ring, whatever is done to either the ladder
  or the `--lr-icon-button-size` cap.
- `--lr-radio-radius` (default `--lr-radius-pill`) — the corner radius of the control's own chrome.
  A circular indicator is fully round at every setting; `<lr-radio-button>` re-points this knob at
  the shared control radius and `pill` swaps it back to a pill.
- `--lr-radio-label-indent` (default `calc(var(--lr-radio-circle-size) + var(--lr-space-s))`) — the
  inline distance from the control's start edge to the start of the label text, i.e. the circle plus
  the gap beside it. The rendered gap is derived from it, so the advertised value and the real offset
  cannot drift; setting it on the element (or on `lr-radio` in your own stylesheet) moves the label.
  Exactly the same knob, purpose, and sideways-inheritance caveat as `--lr-checkbox-label-indent` —
  see `lr-checkbox` above for the formula to align a sibling hint element.

`--lr-radio-checked-border-color` (default `var(--lr-color-brand)`) and `--lr-radio-checked-dot-color`
(default `var(--lr-color-brand)`) recolor `[part='circle']`'s border and `[part='dot']`'s background
while `checked` — a component-scoped indirection (the same pattern `lr-checkbox`'s own
`--lr-checkbox-checked-bg`/`-border` pair uses) so a consumer can retint just this control's checked
ring/dot without hijacking the shared `--lr-color-brand` token everything else reads.

```html
<lr-radio name="format" value="json">JSON</lr-radio>
```

## `lr-radio-button`

The same single-choice control as `lr-radio`, rendered as a button instead of a circle. Mirrors
`sl-radio-button`.

Deliberately a **subclass of `LyraRadio`**: form association, validity, `form.reset()` restoration
and the whole `lr-radio-group` ownership/roving-focus contract are inherited rather than
reimplemented, so the two can never drift apart. Only the chrome differs. A `lr-radio-group` accepts
either tag and the two can be mixed in one group.

Consecutive `lr-radio-button` siblings collapse their shared borders into one segmented control
automatically, via `:host(:first-of-type)` / `:host(:last-of-type)` — `:of-type` counts only
`lr-radio-button` siblings, so a group's `slot="label"`/`slot="hint"` children never shift the ends,
and nothing has to be set on the group. A lone button matches both ends and comes out fully rounded.

**Properties and methods:** identical to `lr-radio` — `checked`, `disabled`, `name`, `required`,
`value`, `size`, `pill`; `click()`, `focus()`, `blur()`, `setCustomValidity()`. `size` is where this
chrome differs most visibly: the shared ladder drives the button's height (floored at `1.5rem`),
inline padding and font size, so a `size="small"` radio button sits at the same height as a
`size="small"` `lr-button` beside it. `pill` is the one inherited property that does *more* here
than on a plain `lr-radio` — see the radius note below.

**Events:** identical to `lr-radio` — `input` and `change` on selection; `lr-change`
(`detail: { checked, value }`) only for a *standalone* button, since an owning `lr-radio-group`
emits its own aggregate `lr-change` instead; and `focus` / `blur`, re-emitted because the internal
control's own do not cross the shadow boundary.

**Slots:** default (label text), `prefix` (leading content, typically an icon), `suffix`.

**CSS parts:** `base`, `prefix`, `label`, `suffix`. `base` carries `checked` and `disabled` as
additional part tokens (`::part(base checked)`), because an attribute selector after `::part()`
never matches.

**Themeable custom properties:** `--lr-radio-radius` is the one inherited knob this element really
uses. `lr-radio` points it at `--lr-radius-pill` for its circular indicator; this subclass re-points
it at `--lr-form-control-radius` — the active `size` tier's shared corner radius — and `pill` swaps
it back to `--lr-radius-pill`. Only the *outer* corners of a run take it: consecutive siblings
collapse their shared borders, so the radius lands on the first button's leading corners and the
last button's trailing ones. Everything else is shared tokens — `--lr-color-brand` /
`--lr-color-on-brand` / `--lr-color-brand-quiet` (selected and hover fills),
`--lr-color-surface-raised`, `--lr-color-border`, and the `--lr-form-control-*` ladder values behind
the height, padding and font size.

Because this is a subclass, the manifest also lists `lr-radio`'s own `circle` and `dot` parts and
its `--lr-radio-circle-size`, `--lr-radio-dot-size`, `--lr-radio-label-indent`,
`--lr-radio-checked-border-color` and `--lr-radio-checked-dot-color` custom properties. **This
element renders none of those** — it draws a button, not a circle and dot — so styling them here has
no effect. They are inherited declarations, not surface. `--lr-radio-radius` is the exception, and
the only one of the set worth setting on this tag.

```html
<lr-radio-group name="view" label="View">
  <lr-radio-button value="day" checked>Day</lr-radio-button>
  <lr-radio-button value="week">Week</lr-radio-button>
</lr-radio-group>
```

---

## `lr-otp-input`

A form-associated one-time-code field: several character segments that together hold one value.
Mirrors `wa-otp-input`.

The segments are **presentational**. A single real `<input>` sits transparently across them and owns
focus, selection and the value — which is what makes paste, SMS autofill (`autocomplete` defaults to
`one-time-code`), IME composition and mobile keyboards work without reimplementing any of it, and
keeps the control to one tab stop rather than one per character.

Every entry path — typing, paste, autofill, a `value` assignment, a narrowing `type` change — funnels
through one sanitizer, so none of them can produce a value another could not. Characters the current
`type` rejects are dropped silently: pasting `"ABC-123"` into a numeric field yields `123`.

**Properties:** `label`, `hint`, `errorText` (`error-text`); `length: number = 6` (reflected);
`format: string = ''` (reflected) — `#` marks a segment and any other character becomes a literal
separator (`format="###-###"`), overriding `length`; `type: 'numeric' | 'alpha' | 'alphanumeric' =
'numeric'` (reflected, also drives `inputmode`); `case: 'preserve' | 'upper' | 'lower' = 'preserve'`
(reflected); `mask: boolean = false` and `withMask: boolean = false` (`with-mask`) — display-only,
`value` and the screen-reader text are unaffected; `readonly: boolean = false`;
`autocomplete: string = 'one-time-code'`; plus the shared form-associated surface (`name`, `value`,
`disabled`, `required`, `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`,
`reportValidity()`).

**Methods:** `focus()`, `blur()`, `click()`, `select()`.

**Read-only:** `segmentCount: number` — how many segments are actually rendered, i.e. `format`'s `#`
count when `format` is set, else `length`, clamped to 1–32. This is the number `value` is truncated
to and the field is validated against, so read it rather than re-deriving it from `length`.

**Events:** `input`, `change`, and `lr-complete` — `detail: { value }`, once every segment is filled.

**Slots:** `label`, `hint`, `error` (each replaces the matching attribute for rich content).

**CSS parts:** `base`, `label`, `field`, `control` (the real, transparent input), `segment`,
`separator`, `hint`, `error`. `segment` carries `active`, `masked`, `placeholder-mask` and `invalid`
as additional part tokens.

**Themeable custom properties:** `--lr-otp-input-mask-char` (the mask glyph — must be a *quoted*
string, it is used as CSS `content`); otherwise shared tokens.

**Validation:** a partially-entered code reports `tooShort` with the localized `otpInputIncomplete`
message; `required` and empty reports `valueMissing`. Validation text only renders once the user has
engaged with the field.

```html
<lr-otp-input label="Verification code" required error-text="Enter the code we sent you."></lr-otp-input>
<lr-otp-input label="License key" type="alphanumeric" case="upper" format="####-####-####"></lr-otp-input>
```

---

## `lr-radio-group`

A labeled, keyboard-navigable group of `lr-radio` controls. Arrow keys, Home, and End move
focus; arrow navigation selects the next enabled radio.

**Properties:** `label`, `hint`, `errorText` (`error-text`), `name`, `required`, `disabled`,
`aria-label` (through `accessibleLabel`), and `size: LyraSize = 'm'` (reflected) — the size of the
group's **own** chrome, on the shared ladder and accepting both `2xs`/`xs`/`s`/`m`/`l`/`xl` and
`small`/`medium`/`large`. It scales the group's label type size and the gaps around and between its
options off the same values the controls themselves use. It deliberately does **not** resize the
`<lr-radio>`/`<lr-radio-button>` children: each carries its own `size`, so a group can hold options
at mixed sizes and an explicitly-sized option is never silently overridden by its container. Set the
same `size` on the children to scale the whole group.

**Events:** exactly one group-owned `lr-change` with `{ value, radio }` per owned selection,
including keyboard activation. The selected child does not emit its standalone alias. Ownership is
resolved synchronously, so immediate removal restores standalone behavior and immediate reparenting
routes the event to the new group without waiting for a mutation-observer turn.

**Slots:** default radios, `label`, `hint`, `error`.

**CSS parts:** `base`, `label`, `hint`, `error`.

**Themeable custom properties:** `--lr-radio-group-row-gap` (default
`calc(var(--lr-form-control-height) * 0.2)`) — the vertical gap between the group's label, its
options and its messages, scaled by `size` through the shared control ladder.

## `lr-checkbox-group`

A form-associated collection of `<lr-checkbox>` children. Its `value` is a `string[]`; each
selected value is submitted under `name` and `required` requires at least one selection.

**Properties:** `label`, `hint`, `errorText`, `value`, `name`, `required`, `disabled`,
`accessibleLabel` (`aria-label`), and `size: LyraSize = 'm'` (reflected) — the size of the group's
**own** chrome, on the shared ladder and accepting both `2xs`/`xs`/`s`/`m`/`l`/`xl` and
`small`/`medium`/`large`. It scales the group's label type size and the gaps around and between its
options, and deliberately does **not** resize the `<lr-checkbox>` children: each carries its own
`size`, so a group can hold options at mixed sizes and an explicitly-sized option is never silently
overridden by its container. Set the same `size` on the children to scale the whole group.
**Slots:** default checkboxes, `label`, `hint`, `error`.
**Events:** a user toggle emits exactly one group-owned `input`, then `change`, then `lr-change`;
all three carry `{ value: string[] }`. The owned child's corresponding events are consumed at the
group boundary, so an ancestor does not receive a second, differently shaped sequence.
Programmatic child/property synchronization is silent.
**Methods:** `setCustomValidity(message)` sets or clears a consumer-supplied error ("that
combination of topics is not available"): a non-empty message raises `customError` and blocks
submission, `''` restores the group's own computed validity so a required group with nothing checked
goes back to `valueMissing`. It survives every child toggle, slot change and form reset.
**CSS parts:** `form-control`, `form-control-label`, `options`, `hint`, `error`.
**Themeable custom properties:** `--lr-checkbox-group-row-gap` (default
`calc(var(--lr-form-control-height) * 0.1)`), the vertical gap between the group's label, options
and messages, and `--lr-checkbox-group-option-gap` (default
`calc(var(--lr-form-control-height) * 0.2)`), the gap between adjacent options — both scaled by
`size` through the shared control ladder.

**`value` is a read-out of child state, not an input.** The children are the single source of
truth. An internal sync recomputes `value` from them and reassigns it on every child toggle,
programmatic child `checked`/`value`/`disabled` update, `slotchange`, `name`/`required` change,
blur, and `form.reset()` — so a host assignment is silently overwritten by the next of those.
Only a checkbox whose nearest `lr-checkbox-group` ancestor is this group contributes; a nested
group owns its own descendants and form entries. `connectedCallback()` runs that sync **before the
first render**, which means even a constructor-time or template-time `.value=${…}` binding is
discarded before anything can observe it. Assigning `value` logs a `console.warn` naming the
property (once per group instance).

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
input), `spellcheck: boolean = true`, `autocapitalize: string = ''`, and `autoCorrect: string = ''`
(attribute `autocorrect`) — all three native text-entry hints are forwarded to both the draft input
and the inline token editor — `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected —
same scale as `lr-input`'s `size`, scaling the input-wrapper's row height and text size across six
tiers, and both `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large` are accepted; the remove
button's hit area stays fixed at `40px` across all sizes), `pill` (reflected, default `false` —
rounds the token row's corners to a full pill by re-assigning `--lr-token-input-radius` to
`--lr-radius-pill`; the chips share that knob with the row, so they round with it),
`allowDuplicates`
(`allow-duplicates`, default `false`), `editable` (reflected, default `false` — see below), and
`delimiter: string | null` (default `','` — see below).
**Slots:** `label`, `hint`, `error`.
**Events:** native-style `input` and `change` (`detail: { value: string[] }`), bubbling/composed
`focus` and `blur` re-dispatched from the internal text input, `lr-add` (`detail: { value }`),
`lr-remove`
(`detail: { value, index }` — cancelable; `preventDefault()` keeps the token in `value`
unchanged), and `lr-token-edit`
(`detail: { value, previousValue, index }` — an existing token was edited in place and committed).
**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `token`, `token-label` (the
token's text, doubling as the roving-focus edit trigger — rendered only while `editable`),
`token-editor` (the inline text field that replaces a token's text while it is open for editing —
rendered only while `editable` and only for the token being edited), `remove` (the
per-token remove button, floored at the shared `--lr-icon-button-size` tap size around a compact
glyph), `input`, `hint`, `error`. `focus()`, `blur()`, and `click()` forward to the internal text
input. `setCustomValidity(message)` carries a rejection no client-side constraint can express
("that tag is reserved"): a non-empty message raises `customError` and blocks submission, `''`
restores the control's own computed validity so a `required` control with no tokens goes back to
`valueMissing`. It survives every token add, removal and edit, and a `form.reset()`.

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

**Additional API surface:**

- `--lr-token-input-token-padding` — Per-token chip padding, scaled by `size`.
- `--lr-token-input-gap` — Gap between form/row children. Default: `var(--lr-space-xs)`.
- `--lr-token-input-token-gap` — Gap inside token chips. Default: `var(--lr-space-2xs)`.
- `--lr-token-input-radius` — Row/token corner radius. Default: `var(--lr-radius)`.
- `--lr-token-input-token-bg` — Token chip background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-token-input-action-hover-bg` — Edit/remove hover background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-token-input-focus-border-color` — Focused row border color. Default: `var(--lr-color-brand)`.
- `--lr-token-input-invalid-border-color` — Invalid row border color. Default: `var(--lr-color-danger)`.

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
  `resize`; an invalid runtime value falls back to `'both'`
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

**Additional API surface:**

- `selectionDirection` — The current selection direction of the internal editing surface. Type: `'forward' | 'backward' | 'none'`.
- `click()` — Activates the internal editing surface.

## `lr-color-picker`

A form-associated colour picker with label, hint and error chrome: a compact swatch trigger that
opens a popover holding a saturation/brightness grid, a hue slider, an optional alpha slider, a text
field accepting any parseable CSS colour, an optional predefined palette, and — where the browser
supports it — a screen eyedropper.

**Rewritten in 8.0.0.** It used to wrap a bare native `<input type="color">`; it is now a real
picker built from the pieces above. Two consequences for existing code:

- **`::part(input)` now names the panel's text field, not the swatch.** The swatch is
  `::part(trigger)`. A stylesheet that targeted `input` to size or tint the visible control has to
  move to `trigger`.
- The visible control is a `<button>` (`[part="trigger"]`), so `focus()`/`blur()`/`click()` target
  it, and there is no native colour input in the shadow tree to reach for.

`value` is always serialized in the active `format` (`hex` by default), so reading it back after any
interaction gives a canonical string in exactly one syntax; switching `format`, `opacity` or
`uppercase` **re-serializes the same colour** rather than reinterpreting it. Input is far more
permissive than output: hex (3/4/6/8 digit), `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hsv()`/`hsva()`,
CSS colour names, and any other colour syntax the browser itself parses are all accepted. A value
that is not a colour at all is **kept verbatim** rather than silently replaced, so a consumer's own
sentinel survives a round trip. An element with neither a `value` attribute nor a value defaults to
`#000000`, and `form.reset()` returns to the declarative `value` attribute (or to `#000000`).

Colour is never the only channel carrying state: the trigger's `aria-describedby` points at a
visually-hidden span spelling the current value out in text, the panel shows it in an editable
field, and the selected palette swatch is marked with `aria-pressed` plus a check mark rather than
a tint alone.

**Not the same control as `lr-swatch-picker`.** This one is freeform: `swatches` is a shortcut row
*beside* a saturation grid, a hue ramp and a text field, and the committed value can be any colour
the browser parses. `<lr-swatch-picker>` offers exactly its `options` and nothing else, with
`radiogroup` semantics rather than a popover. Reach for it when the answer must be one of N
designer-chosen colours; reach for this when it must not.

**Properties:** the shared
form properties `name`, `value`, `disabled`, and `required`, plus `label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), and `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'`
(reflected — same scale as `lr-input`'s `size`, for compact swatch rendering at every density tier),
and:

- `format: 'hex' | 'rgb' | 'hsl' | 'hsv' = 'hex'` — the syntax `value` is **written** in. Parsing is
  always permissive regardless of it. The format button cycles through the four in that order
- `opacity: boolean = false` — enables the alpha channel: an opacity slider appears in the panel and
  the serialized value gains its alpha-carrying twin (`hexa`/`rgba`/`hsla`/`hsva`). With it unset,
  picking a palette entry forces alpha back to 1
- `uppercase: boolean = false` — serializes `value` in upper case (`#FF0000` rather than `#ff0000`);
  applies to the whole string, function names included (`RGB(255, 0, 0)`)
- `swatches: string | string[] | LyraColorPickerSwatch[] = ''` — a predefined palette, given as a
  `;`-separated string, an array of colour strings, or an array of
  `{ color: string; label?: string }` objects. Any colour the picker can parse is accepted; blank
  entries are dropped. An entry that is *not* parseable is kept in the list and still renders a
  swatch — it just paints no colour (the bare checkerboard) and clicking it does nothing, so filter
  the palette yourself if that matters. `label` becomes the swatch's accessible name — without one
  the raw colour string is announced. The palette container renders only while the normalized list
  is non-empty
- `withoutFormatToggle: boolean = false` (attribute `without-format-toggle`) — removes the button
  that cycles between formats
- `placement: Placement = 'bottom-start'` (reflected) — preferred panel placement, from the Floating
  UI vocabulary. The resolved side still flips/shifts to stay in the viewport, and the
  `left`/`right` component is swapped under RTL
- `open: boolean = false` (reflected) — whether the panel is showing. Assigning `true` while the
  control is effectively disabled is ignored, and a `disabled` that flips on while the panel is
  already open closes it

**Methods:** `show()` opens the panel (a no-op while effectively disabled), `hide()` closes it and
returns focus to the trigger, and `click()`/`focus(options?)`/`blur()` forward to the trigger.
`getFormattedValue(format?)` returns the current colour in any of the eight output formats —
`'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsv' | 'hsva'`, defaulting to `'hex'` —
independently of `format`/`opacity`, honouring `uppercase`. Use it to read, say, an `rgba()` string
out of a picker configured to store hex, without touching `value`.

**Slots:** `label`, `hint`, `error`. **Events:**
composed `input` (fired for every colour change during an interaction) and `change` (fired once an
interaction commits: pointer release, key release, swatch click, text entry, eyedropper result),
`lr-change` with `{ value }` (the newly serialized value), `lr-show` and `lr-hide` (the panel opened
or closed — never emitted for a declaratively-open picker's first render, nor for a close caused by
disconnection), and `focus`/`blur` (re-dispatched from
the trigger's own `focus`/`blur`, bubbling and composed unlike the native events). A change that
doesn't move the serialized value emits nothing, so dragging within a single rounded colour is
silent.

**Keyboard.** The grid handle, hue handle and opacity handle are each a real `role="slider"` with a
localized name and `aria-valuetext`. Arrow keys step by 1 (percent or degree), Shift+Arrow by 10,
and Home/End jump to that axis' extremes; ArrowLeft/ArrowRight swap meaning under RTL, ArrowUp/Down
never do. One discrete press pairs a keydown (`input`) with a keyup (`change`); OS key repeat
re-fires `input` but still commits once. The panel is Escape-dismissible and returns focus to the
trigger; a pointerdown outside the element closes it too.

**CSS parts:** `form-control`, `form-control-label` (the label; `label` is an alias kept for
back-compat), `trigger-container` (the row wrapping the trigger), `trigger` (the swatch button that
opens the panel), `panel` (the positioned `role="dialog"` surface), `grid` (the
saturation/brightness square) and `grid-handle` (its draggable, keyboard-operable handle),
`slider` and `slider-handle` (carried by **both** ramps), `hue-slider` / `hue-slider-handle` and
`opacity-slider` / `opacity-slider-handle` (each also carrying the shared `slider`/`slider-handle`
token, so `::part(slider)` styles both ramps while `::part(hue-slider)` reaches only one; the
opacity pair renders only with `opacity` set), `preview` (the current-colour dot beside the ramps),
`input` (the text field holding the serialized value), `format-button` (the format-cycling button,
absent with `without-format-toggle`), `eyedropper-button` (rendered only where the browser exposes
the EyeDropper API), `swatches` (the palette container, rendered only when the normalized `swatches`
list is non-empty), `swatch` (one palette entry), `swatch-selected` (a token **added to** the
swatch matching the current value — state after `::part()` never matches, so write
`::part(swatch-selected)`), `hint`, `error`.

**Themeable custom properties:** `--lr-color-picker-swatch-size` — the trigger's inline and block size,
auto-swapped per `size` tier (default `'m'` reads `2.5rem`, `'2xs'` reads `1.25rem`, etc.), matching
the size ladder `lr-input` uses. The panel's geometry has its own set, all declared on `:host`:

- `--lr-color-picker-grid-inline-size` (default `var(--lr-size-15rem)`) and
  `--lr-color-picker-grid-block-size` (default `var(--lr-size-8rem)`) — the saturation/brightness
  square's width and height. The first also caps the palette row's width.
- `--lr-color-picker-grid-handle-size` (default `var(--lr-size-1rem)`) — diameter of the grid handle.
- `--lr-color-picker-slider-block-size` (default `var(--lr-size-0-75rem)`) — thickness of the
  **visible** hue/opacity ramp. The slider's own pointer target stays floored at 24px regardless, so
  thinning the ramp never shrinks the touch target.
- `--lr-color-picker-slider-handle-size` (default `var(--lr-size-1-25rem)`) — diameter of a slider
  handle.
- `--lr-color-picker-palette-swatch-size` (default `var(--lr-size-1-5rem)`) — size of a palette
  swatch, and of the `preview` dot.
- `--lr-color-picker-checker-color` (default `var(--lr-color-border)`) and
  `--lr-color-picker-checker-size` (default `var(--lr-size-0-5rem)`) — tint and cell size of the
  alpha checkerboard drawn behind the trigger, preview, swatches and opacity ramp.
- `--lr-color-picker-hue-stops` — the hue ramp's own gradient stops, defaulting to the six-stop sRGB
  hue wheel. Both text directions read the same list; only the gradient's direction differs.
  Override it to theme a wide-gamut or perceptually-uniform ramp.

Three more are **state, not configuration** — the component rewrites each inline on every render, so
setting them from a stylesheet has no lasting effect: `--lr-color-picker-swatch-color` (the live
colour painted on the trigger, preview, slider handles and palette swatches),
`--lr-color-picker-grid-hue` (the grid's fully-saturated base hue), and
`--lr-color-picker-opacity-gradient` (the opacity ramp's transparent-to-opaque gradient, built from
the current colour and text direction). Read them if you need the resolved colour; don't assign them.

**Additional API surface:**

- `click()` — Activates the internal trigger button, opening or closing the panel.
- `--lr-color-picker-gap` — Gap between field chrome and panel rows. Default: `var(--lr-space-xs)`.
- `--lr-color-picker-radius` — Trigger, grid, field and panel corner radius. Default: `var(--lr-radius)`.
- `--lr-color-picker-hover-border-color` — Hover border color, shared by the trigger, handles, text
  field, format/eyedropper buttons and palette swatches. Default: `var(--lr-color-brand)`.

```html
<lr-color-picker
  name="accent"
  label="Accent colour"
  hint="Used for links and primary buttons."
  format="rgb"
  opacity
  uppercase
  placement="bottom-end"
  swatches="#e11d48;#2563eb;#16a34a"
></lr-color-picker>
<script type="module">
  import '@aceshooting/lyra-ui/components/forms/color-picker/color-picker.js';
  const picker = document.querySelector('lr-color-picker');
  // Objects give each entry a real accessible name:
  picker.swatches = [
    { color: '#e11d48', label: 'Rose' },
    { color: '#2563eb', label: 'Blue' },
  ];
  picker.addEventListener('change', () => {
    console.log(picker.value);                    // e.g. "RGBA(225, 29, 72, 1.00)"
    console.log(picker.getFormattedValue('hexa')); // e.g. "#E11D48FF"
  });
  picker.show();
</script>
```

**Known gotchas:**
- **The `input` CSS part moved.** It is the panel's text field as of 8.0.0; the swatch is `trigger`.
- The eyedropper button is only in the DOM where `window.EyeDropper` exists (feature-detected once,
  at connect). Dismissing the eyedropper rejects the platform promise, which is treated as a
  cancellation, not an error — nothing is surfaced and nothing changes.
- A non-colour `value` is preserved verbatim, so `value` is not guaranteed to be parseable as a
  colour just because the element accepted it. `getFormattedValue()` always reports the picker's
  own working colour, which in that case is whatever was last understood.
- A disconnect/reconnect cycle (a drag-and-drop reparent, a virtualized list reordering) closes the
  panel rather than leaving it rendered at a stale, frozen position, and an abandoned half-typed
  entry in the text field is discarded rather than reappearing on the next open.

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
`groups: EmojiPickerGroup[] = []` (attribute: false) — `EmojiPickerGroup { key, label, labelKey?,
emojis: EmojiPickerItem[] }`, `EmojiPickerItem { emoji, name, shortcodes? }`; the search field matches
`name` and every `shortcodes` entry, case-insensitively. `labelKey` is an optional `LyraMessageKey`
naming `label`'s localized form — set only by the built-in `emoji-picker-element-data` adapter, whose
headings come from emojibase's fixed group ids, so an auto-loaded emoji set's group headings follow
`registerLyraLocale()`/`.strings` instead of staying English. A hand-authored group leaves it unset
and its `label` renders verbatim, because a consumer-supplied heading is caller-owned content this
library never translates. Empty (the default, before the auto-loader
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

**Events:** a pick emits native-style composed `input`, then `change` (both with no detail), then
`lr-change` with `detail: { emoji }` (click, or Enter/Space on the active grid cell; also sets
`value`). The internal search input's `focus` and `blur` are re-dispatched as bubbling, composed
host events. Programmatic `value` changes are silent.

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
`calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l))`, one windowed row's height).
`--lr-emoji-picker-item-size`, `--lr-emoji-picker-gap`, and `--lr-emoji-picker-row-height` are also
read back in JS to derive columns-per-row and row offsets for the windowed layout,
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
`console.warn` and simply leaves `groups` empty. The adapter buckets the peer's flat entry list by
its numeric `group` id and tags each bucket with both the English `label` and the matching
`labelKey` — `emojiPickerGroupSmileysEmotion`, `emojiPickerGroupPeopleBody`,
`emojiPickerGroupComponent`, `emojiPickerGroupAnimalsNature`, `emojiPickerGroupFoodDrink`,
`emojiPickerGroupTravelPlaces`, `emojiPickerGroupActivities`, `emojiPickerGroupObjects`,
`emojiPickerGroupSymbols`, `emojiPickerGroupFlags` (group ids 0–9, in that order). Override any of
them through `registerLyraLocale()` or a `.strings` object to translate the headings. An unknown
future group id gets no `labelKey` and falls back to a generated `Group {id}` label.

**Additional API surface:**

- `--lr-emoji-picker-control-gap` — Gap between field sections. Default: `var(--lr-space-xs)`.
- `--lr-emoji-picker-radius` — Outer picker corner radius. Default: `var(--lr-radius)`.
- `--lr-emoji-picker-item-radius` — Search and emoji corner radius. Default: `var(--lr-radius-xs)`.
- `--lr-emoji-picker-search-hover-border-color` — Search hover border. Default: `var(--lr-color-brand)`.

## `lr-rubric-form`

A configurable annotation rubric (LangSmith annotation-queue style): score, category, and
freeform-comment keys with a submit-and-next flow for working through an eval queue. Each
`RubricKey.type` routes to an existing sibling control: `score` renders `<lr-segmented>` or
`<lr-slider>`; `category` renders `<lr-select>` or `<lr-checkbox-group>` (`multiple`); `comment`
renders `<lr-textarea>`.

**Properties:** `keys: RubricKey[] = []` (attribute: false, each `{ key, type, label?, description?,
required?, min?, max?, step?, options?, multiple?, placeholder? }`; `options?` contains
`RubricKeyOption { value: string; label?: string; description?: string }`, `multiple?` selects the
checkbox-group category route, and `placeholder?` customizes comment input), `value: RubricValue =
{}` (attribute: false), `itemId: string = ''`
(attribute `item-id`, reflected), `hasNext: boolean = false` (attribute `has-next`), `skippable:
boolean = false`, and the shared form properties `name` and `disabled`. `errors: Record<string,
string>` is the current per-key validation-message state.

**Slots:** `actions` — extra host controls rendered in the footer beside Submit/Skip.

**Events:** `lr-input` (`detail: { value }`), `lr-validity-change` (`detail: { valid, errors }`,
fired only on an actual change), `lr-submit` (`detail: { value, itemId }`), and `lr-skip`
(`detail: { itemId }`, `skippable` only).

**Methods:** `setCustomValidity(message)` sets or clears a form-level error no per-key rule can
express ("this item was already annotated by someone else"): a non-empty message raises
`customError` and blocks submission, `''` restores the rubric's own computed validity — unanswered
required keys, and any key with an unsupported `type`, still hold it invalid. It is independent of
the per-key `errors` map, which stays a read-out of this rubric's own field rules, so a message set
here is never attributed to one key. It survives every `value`/`keys` write and a form reset.

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
  LyraLocaleEntry[]`, `LyraLocaleEntry { tag: string; label?: string; country?: string }`. Empty
  (the default) auto-discovers the registry; a non-empty array (either form) overrides it
  entirely — a curated subset, custom order, custom labels, or a locale offered before its
  strings are registered. `country` (ISO 3166-1 alpha-2) overrides a row's derived flag — e.g.
  showing Lebanon's flag for an `'ar'` row instead of the library's default Saudi Arabia mapping;
  only available on the `{tag,label,country}` object form, not the bare `string[]` form.
- `showFlags: boolean = true` — each row's leading `<lr-flag language={tag} variant="compact">`
  (or `<lr-flag country={country} variant="compact">` when the entry sets `country`); `false`
  omits the flag element entirely (not just visually).
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
button, same convention as `lr-select`'s identical trio. `setCustomValidity(message)` sets or clears
a consumer-supplied error ("that locale is not enabled for your account"): a non-empty message
raises `customError` and blocks submission, `''` restores the picker's own computed validity so a
required picker with nothing committed goes back to `valueMissing`. It survives every
`value`/`required` change and a form reset.

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
  import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';
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

**Additional API surface:**

- `--lr-locale-picker-gap` — Trigger and option child gap. Default: `var(--lr-space-xs)`.
- `--lr-locale-picker-radius` — Trigger/listbox/option corner radius. Default: `var(--lr-radius)`.
- `--lr-locale-picker-trigger-hover-bg` — Trigger hover background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-locale-picker-open-border-color` — Open trigger border color. Default: `var(--lr-color-brand)`.
- `--lr-locale-picker-option-selected-border-color` — Selected option border. Default: `var(--lr-color-brand)`.
- `--lr-locale-picker-option-selected-color` — Selected option text. Default: `var(--lr-color-brand)`.
