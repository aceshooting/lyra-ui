## Breaking changes in 10.0.0

`<lr-swatch-picker>` drops the three members it carried through 9.x as documented one-major
back-compat aliases, each with a like-for-like replacement that has shipped since. The `options`
property is now `items` — same frozen owned-snapshot contract, still `attribute: false`, so no
markup changes. The `label` property/attribute is now `accessibleLabel` (attribute `aria-label`), or
the host `aria-label` directly; this is the one worth grepping for, because an un-updated
`<lr-swatch-picker label="Brand colours">` leaves the internal `role="radiogroup"` with no accessible
name at all rather than failing loudly. And the exported `SwatchOption` type is now
`SwatchPickerItem`. The item shape itself is unchanged, including its own per-item `label` field,
which is a different member and stays.

Also corrected in 10.0.0 — not breaking, but visible. A specificity sweep found rules that were
meant to win yet were losing to another rule in the same shadow stylesheet, so their declarations
never applied at all. In this family: arrow-keying onto the already-selected option in
`<lr-select>` or `<lr-combobox>` produces a visible keyboard highlight again — `[aria-selected="true"]`
was written after the active-descendant rule at equal specificity and swallowed it, so the highlight
was absent exactly on the row a user is most likely to arrow onto first. `appearance="filled"` has a
focus indicator again on `<lr-combobox>` and `<lr-date-input>`, both of which previously had none:
the appearance rule out-ranked `:focus-within`, and the only `outline` in the focus rule was
`solid transparent`. Both now express appearance as private custom properties, so no `[part]` rule
can out-rank another. `<lr-option>` and `<lr-time-range>`'s active preset regain their pointer
feedback, and `<lr-token-input>` can now veto all three of its mutations (`lr-add` and
`lr-token-edit` became cancelable alongside `lr-remove`, which already was — additive; see that
section).

## Setter-only `null` clearing in 8.0.0

Several mapped string IDLs accept `null` on assignment without widening their read type. This is a
JavaScript/TypeScript compatibility surface: after the write, every getter below still returns its
canonical string. Name attributes are removed; live-value writes follow each control's existing
live/default-value reflection contract. HTML authors remove an attribute instead of writing the
literal text `"null"`.

- `.name = null` clears to `''` on `lr-button`, `lr-checkbox`, `lr-color-picker`, `lr-combobox`,
  `lr-date-input`, `lr-input`, `lr-number-input`, `lr-otp-input`, `lr-radio`, `lr-radio-group`,
  `lr-select`, `lr-switch`, `lr-textarea`, and `lr-time-input`.
- `.value = null` clears to `''` on `lr-color-picker`, `lr-input`, `lr-number-input`, `lr-otp-input`,
  and `lr-radio-group`.
- `.value = null` restores the native checkbox default `'on'` on `lr-checkbox` and `lr-switch`
  while removing the `value` attribute. An explicit non-null `.value = 'on'` instead reflects
  `value="on"`, preserving the distinction between an absent native default and an authored value.

These are setter-only input types, not nullable states: code that reads any member above continues
to receive a `string`.

## The validity alias is cancelable in 8.0.0

Every form-associated control emits `lr-invalid` (no detail, bubbling, composed) as the alias of the
native, non-bubbling `invalid` event. In 8.0.0 that alias is **cancelable**, and its cancellation is
forwarded to the native event that produced it:

```ts
form.addEventListener("lr-invalid", (event) => {
  event.preventDefault(); // suppresses the browser's own validation bubble,
  showMyOwnErrorSummary(event.target); // and reportValidity()'s focus/scroll of this control
});
```

`preventDefault()` suppresses only the platform's _default UI_ — the validation bubble, and the
focus/scroll `reportValidity()` performs on the first invalid control. The control stays invalid,
still fails `checkValidity()`, and still blocks submission. Cancelling a copy of a platform event
could only ever mean cancelling the original, which is why the forwarding exists at all: before it,
an app wiring `lr-invalid` to its own error banner had no way to stop the native UI appearing
alongside it.

Nothing changes for code that ignores the event, and the listener has to be attached before the
validity check runs. Every per-control mention of `lr-invalid` below inherits this contract; the
per-control sections repeat only what is specific to that control.

## Mirrored static validator catalogs

The mirrored form-control constructors expose a public `static validators` catalog with the same
callable shape as Web Awesome's `Validator[]`: `observedAttributes`, `checkValidity(element)`, and
an optional message. The catalog is available on `LyraButton`, `LyraCheckbox`, `LyraColorPicker`,
`LyraInput`, `LyraNumberInput`, `LyraOtpInput`, `LyraRadio`, `LyraRadioGroup`, `LyraSelect`,
`LyraSlider`, `LyraSwitch`, `LyraTextarea`, and `LyraTimeInput`. Each call returns a fresh array;
calling an entry projects the control's current `ValidityState` into `{ isValid, message,
invalidKeys }` without mutating the control.

```ts
import { LyraInput } from "@aceshooting/lyra-ui/components/forms/input/input.js";

const input = document.querySelector("lr-input")!;
const result = LyraInput.validators[0].checkValidity(input);
```

## The required-field marker

A labelled control with `required` set paints ` *` after its label text. It is one shared rule on
the `form-control-label` part, so it looks and sits identically on every control that renders that
part — here, and on `lr-file-input`, `lr-model-select`, `lr-voice-picker` and `lr-tool-param-form`
in the other families. `lr-checkbox`, `lr-switch` and `lr-radio` have no label box of their own and
paint none; a control with the part but no label text set paints none either, so no stray glyph is
orphaned.

Three consumer-settable properties replace it, retune its colour, or suppress it entirely —
`--lr-form-control-required-content` (a quoted CSS `content` string; `''` suppresses the marker),
`--lr-form-control-required-color` (default `var(--lr-color-danger)`), and
`--lr-form-control-required-offset` (default `0`). Each is an inline `var()` fallback rather than a
`:host` declaration, so setting one on any ancestor — `:root` included — reaches every marker at
once. Full description, worked examples, and why the content string is never localized by the
library: `llms/shared.md` → "The required-field marker".

## Disabled and readonly controls publish no invalid state

A control **barred from constraint validation** — its own `disabled`, an ancestor
`<fieldset disabled>`, `readonly` on the controls that have it, or anything else that makes
`willValidate` false — matches neither `:state(invalid)` nor `:state(user-invalid)`, and reports no
violation from `checkValidity()`. That is the native rule: `<input required disabled>` and
`<input required readonly>` both match neither `:valid` nor `:invalid`.

It matters because the idiomatic stylesheet rule keys off the tag —
`lr-input:state(user-invalid) { border-color: … }` — so a disabled required field that still
published `invalid` painted every greyed-out control in the form red.

`required`/`optional` are unaffected: they describe the attribute, not the outcome, so a disabled
required field still matches `:state(required)`, exactly like native `:required`. Style the barred
case through `:state(disabled)`/`:disabled` and `:state(readonly)` instead. Full description in
`llms/shared.md` → "CSS custom states".

## `lr-combobox` / `lr-option`

Filterable single/multi-select combining a text input with a listbox. Mirrors the core
`<wa-combobox>` API under the `lr-` prefix. **Form-associated** (hand-rolled internals, not the
shared `FormAssociated` mixin — see gotchas).

**First-interaction registration.** Where initial-route weight is stricter than a static combobox
registration allows, keep a labelled native `<input list>` as the working pre-JavaScript control
and import only the granular combobox registration on its first focus. Copy the native value after
the import resolves so typing that happens while the chunk is in flight is not lost, then transfer
focus explicitly — the browser does not replay the focus event after custom-element upgrade:

```html
<div id="country-fallback">
  <label for="country-native">Country</label>
  <input id="country-native" name="country" list="country-options">
  <datalist id="country-options"><option value="France"></option></datalist>
</div>
<lr-combobox id="country-enhanced" name="country" label="Country" hidden>
  <lr-option value="France">France</lr-option>
</lr-combobox>
<script type="module">
  const fallback = document.querySelector("#country-fallback");
  const input = document.querySelector("#country-native");
  const combobox = document.querySelector("#country-enhanced");
  let registration;
  input.addEventListener("focus", async () => {
    if (!combobox.hidden) return;
    registration ??= import(
      "@aceshooting/lyra-ui/components/forms/combobox/combobox.js"
    ).catch((error) => {
      registration = undefined; // let a later interaction retry
      throw error;
    });
    await registration;
    await customElements.whenDefined("lr-combobox");
    combobox.value = input.value;
    fallback.hidden = true;
    combobox.hidden = false;
    combobox.focus();
  });
</script>
```

Leave the native control in place if registration fails. This pattern preserves the initial shell;
the full form-label, option, overlay, and first-open positioning contracts arrive in deferred
chunks instead of being weakened in a separate partial combobox implementation.

An `lr-option` row remains bounded by its owning listbox: the default label ellipsizes and each
`start`/`end` (or `prefix`/`suffix`) adornment is capped at 40% of the row. Unbroken metadata
therefore cannot widen a 320px LTR or RTL picker.

**Adornments in the popup (fixed in 11.0.0).** Before 11.0.0 this paragraph described behavior the
code did not have: `lr-combobox` builds its popup from normalized row *data* rather than from the
light-DOM nodes, so a slotted `start`/`end`/`prefix`/`suffix` adornment had nowhere to land and
simply never rendered — the documented slots and their documented parts were both dead inside the
one component `lr-option` exists to feed. They now render. The nodes are **cloned** into the row
(`option-start` / `option-end` parts, inert and `aria-hidden`, so they never join the option's
accessible name), which means the author's own `<lr-option>` subtree is left exactly where they put
it rather than being moved into a shadow root as a side effect of opening a dropdown:

```html
<lr-combobox label="Country">
  <lr-option value="fr"><lr-flag slot="start" country="fr"></lr-flag>France</lr-option>
  <lr-option value="mt"><lr-flag slot="start" country="mt"></lr-flag>Malta</lr-option>
</lr-combobox>
```

An async `source` row can carry the same two fields (`start`, `end`) alongside its existing `icon`.

### `lr-combobox`

**Properties:**

- `multiple: boolean = false` (reflected)
- `size: LyraSize = 'm'` (reflected — the shared control ladder, so both `2xs`/`xs`/`s`/`m`/`l`/`xl`
  and the `small`/`medium`/`large` spellings are accepted; also scales the "+N" overflow tag and
  decorative expand icon; `size="s"` shares its outer control height with `lr-input`, `lr-select`,
  and `lr-segmented` without part overrides)
- `pill: boolean = false` (reflected) — rounds the trigger row's corners to a full pill, mirroring
  `lr-input`'s own `pill`. It changes the private radius default to `--lr-radius-pill`, so an
  inherited or direct `--lr-combobox-radius` remains authoritative
- `placeholder: string = ''`
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`; also reflected as
  `aria-required` on `<input part="combobox-input">` immediately. That semantic input exposes
  `aria-invalid="true"` whenever visible error chrome is present, or after interaction while
  intrinsic/custom validity fails; it explicitly returns to `"false"` when neither applies)
- `name: string = ''`
- `label: string = ''`
- `hint: string = ''`
- `errorText: string = ''` (attribute `error-text` — static error copy shown below the hint;
  overridden by slotted `error` content when provided)
- `open: boolean = false` (reflected)
- `allowCreate: boolean = false` (attribute `allow-create`) — a nonmatching query renders a
  localized create row. Activating it emits cancelable `lr-create`; unless vetoed, the component
  appends a real `<lr-option>` and selects it (also supported in `multiple` mode)
- `allowCustomValue: boolean = false` (attribute `allow-custom-value`) — single-select only;
  commits arbitrary text on Enter without creating an option
- `appearance: 'filled' | 'outlined' | 'filled-outlined' = 'outlined'` (reflected)
- `placement: 'top' | 'bottom' = 'bottom'` (reflected; flip/shift can still keep the listbox in view)
- `clearable: boolean = false` (reflected) — displays the clear button while there is something to
  clear on **either** axis this control owns: a committed selection, or _visible_ filter text. See
  "the clear button covers two axes" below
- `withClear: boolean = false` (attribute `with-clear`) — Web Awesome's spelling of `clearable`;
  either one enables the same clear button. Not deprecated: Web Awesome names this attribute
  `with-clear` and Shoelace names it `clearable`, so honouring both is what keeps a mechanical tag
  rename from silently dropping the control
- `withLabel: boolean = false` and `withHint: boolean = false` (attributes `with-label` and
  `with-hint`) — SSR slot-presence hints
- `getTag: ((option: LyraOption, index: number) => unknown) | undefined` (attribute: false) —
  replaces a built-in multiple-selection tag with consumer Lit/DOM/text output; strings render as
  text, never as HTML
- `validators: LyraComboboxValidator[] = []` (attribute: false) — extra JavaScript validators run
  after the intrinsic `required` constraint, the same contract `lr-date-input` implements. Each
  entry may be a `(value, input) => void | boolean | string | ValidityStateFlags` function (`value`
  is the live `string | string[]`), an object with `validate(value, input)` returning that same
  vocabulary, or a Web Awesome-compatible object with `checkValidity(input)` returning
  `{ isValid, message, invalidKeys }`, where `invalidKeys` names `ValidityState` flags; that object
  may also expose `observedAttributes` and a string or callback `message`. Changing any listed host
  attribute revalidates automatically. `isValid: true` (or `true`/`undefined` from a function)
  passes; otherwise the listed flags are set (`customError` when the list maps to nothing) and the
  returned message wins over the validator-level fallback. A throwing validator fails closed with
  the localized generic message. `disabled` bars them exactly as it bars `required`
- `validationTarget: HTMLElement | undefined` — writable native-validity focus anchor. After the
  first render it defaults to the internal filter input; assign another element to override it, or
  assign `undefined` to restore that input. It is `undefined` before the input exists
- `autocomplete: string = 'off'`, `inputMode: string = ''` (attribute `inputmode`),
  `enterKeyHint: string = ''` (attribute `enterkeyhint`), `spellcheck: boolean = false`,
  `autocapitalize: string = ''`, and `autocorrect: boolean = true` (attribute values `on`/`off`) —
  native editing-assistance properties forwarded to the internal filter input. Removing a
  `spellcheck` attribute after an override restores this component's declared `false` default.
  The lowercase
  mapped IDLs `inputmode` and `enterkeyhint` delegate to the corresponding camel-case native
  properties
- `inputValue: string` — the live filter input text; programmatic writes are event-silent
- `maxOptionsVisible: number = 3` (attribute `max-options-visible` — caps how many selected **tags**
  show before collapsing to `+N`; nothing to do with the suggestion list, see the three-caps note
  below)
- `visibleOptions?: number` (attribute `visible-options`, new in 11.0.0) — bounds the popup to about
  this many suggestion rows, leaving the rest reachable by scrolling. Purely presentational: every
  row is still rendered. Measured from where row N actually starts rather than computed from a
  token, because a row's height varies with `sub` lines, adornments and group labels. Unset imposes
  no bound of its own and the listbox keeps exactly its previous max-height behavior; zero,
  negative, and non-finite values normalize to unset rather than collapsing the popup

**The three caps, which are easy to confuse.** `visibleOptions` caps how many suggestion rows are
*visible* (presentation; the rest scroll). `maxRender` caps how many suggestion rows are *rendered
at all* (performance; the rest do not exist and are summarized by `option-overflow`).
`maxOptionsVisible` caps how many *selected tags* show in multi-select and never touches the
suggestion list.
- `emptyText?: string` (attribute `empty-text`) — omission displays localized `noMatches` (`"No
matches"` in the built-in English locale); any supplied string, including `''`, renders verbatim
- `loadingText?: string` (attribute `loading-text`) — shown while a `source` fetch is in flight;
  omission displays localized `loading` (`"Loading…"` in English), while any supplied string,
  including `''`, renders verbatim
- `overflowText?: string` (attribute `overflow-text`) — shown when `maxRender` caps the rows;
  omission displays localized `comboboxOverflow` (`"+{n} more — refine your search"` in English).
  A supplied template wins verbatim over `.strings`, including when it equals that English
  template or is empty; `{n}` is still replaced with the locale-formatted hidden count
- `filter: OptionFilter | null = null` (attribute: false — `(option, query) => boolean`; default
  matches `label`/`searchText` case-insensitively; ignored while `source` is set)
- `source: ComboboxSource | null = null` (attribute: false — `(query: string, options: { signal:
AbortSignal; limit: number }) => Promise<readonly ComboboxSourceRow[] | { rows, total? }>`; when set, replaces the light-DOM `<lr-option>`
  list with an async lookup, debounced by `sourceDelay` ms after each keystroke and re-run on
  clear/pick. Forward `options.signal` to `fetch(url, { signal })` to cancel the request when a
  newer query supersedes it or the element disconnects. `loadingText` is shown while a call is in
  flight; a stale in-flight call that resolves after a newer one (or after disconnect) is dropped
  via a monotonic token. The exported type requires the `options` parameter; an existing
  one-parameter `(query) => …` function remains assignable under TypeScript's ordinary function
  parameter compatibility, but consumers that need cancellation should accept and forward
  `options.signal`; honor `options.limit` when practical and return `{ rows, total }` to report the
  provider-side match count. The component independently clone-normalizes the result, retains at
  most 2,000 rows/250,000 aggregate text units, skips malformed or hostile rows, and never trusts a
  provider to enforce the ceiling. A current rejection clears stale rows and renders a localized disabled
  listbox row; that visible row is not a shadow live region. The same localized message is appended
  to `[data-lr-live-region="assertive"]` in the document for each fresh post-mount rejection,
  including an identical retry, while raw caught error text stays out of the UI.)
- `sourceDelay: number = 200` (attribute `source-delay` — debounce in ms between the last keystroke
  and the `source` call; `0` fires on every keystroke. Sanitized to a finite non-negative duration,
  falling back to `200` for a non-finite value)
- `maxRender: number = 200` (attribute `max-render` — caps how many rows render at once, always
  keeping the current selection visible even if it's outside the cap; the excess renders as one
  `overflowText` row instead of being dropped silently. See "Large option lists" below for how to
  size it, and when `source` is the better answer. Runtime writes are capped at 1,000)
- `sourceTotal: number` (read-only) — provider-side total for the latest accepted response
- `sourceTruncated: boolean` (read-only) — whether the response reported or contained more rows
  than the bounded retained snapshot; the overflow row includes that hidden count
- `value: string | string[]` — a getter/setter: plain `string` in single mode, `string[]` in
  `multiple` mode
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message
- `selectedRows: ComboboxSourceRow[]` (read-only getter) — structured rows for the current
  selection, including any opaque `data` payload supplied by an async source. Selected async rows
  remain available after the query changes or a later source result no longer contains them
- `selectionStart`, `selectionEnd`, and `selectionDirection` — selection getters/setters forwarded
  to the internal input

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and `setRangeText()`
forward to the internal input. `setRangeText()` synchronizes the filter query and visible options.
`show(): Promise<void>` and `hide(): Promise<void>` settle after `lr-after-show` and
`lr-after-hide`, respectively. `resetValidity()` clears consumer custom validity and restores the
current intrinsic constraints. `getForm()` returns the owning form, including an external owner
selected by the `form` attribute.
`setCustomValidity(message)` carries a rejection no client-side constraint can express ("that option
is no longer available"): a non-empty message raises `customError`, becomes `validationMessage`, and
blocks submission; `''` clears it and restores the control's own computed validity, so a `required`
combobox with nothing chosen goes back to `valueMissing` rather than to valid. The message survives
every selection change and a `form.reset()` — like a native control, only another
`setCustomValidity('')` or `resetValidity()` clears it — and is used verbatim, never localized.

**8.0 migration:** the former camel-case string property `autoCorrect` is not retained as a public
alias. Set the boolean `autocorrect` IDL, or use `autocorrect="on"` / `autocorrect="off"` in markup.

`ComboboxSourceRow = { readonly value: string; readonly label: string; readonly sub?: string; readonly icon?: unknown; readonly start?: unknown;
readonly end?: unknown; readonly badge?: string |
number; accessibleLabel?: string; data?: unknown; dotColor?: string; group?: string; disabled?:
boolean }` — the row shape used by the async `source` path. `start` and `end` (new in 11.0.0) are
the async counterparts of `<lr-option>`'s `start`/`end` adornment slots and render as the
`option-start` / `option-end` parts, inert and aria-hidden exactly like `icon`. `icon` renders as a decorative leading
visual whose rendered subtree stays visible but is inert and hidden from assistive technology;
put independent actions outside it. `badge` renders as trailing metadata, `accessibleLabel` can
provide richer spoken text than the visible label, and `data` is retained without being rendered
for retrieval through `selectedRows`.
`dotColor` accepts a valid CSS `color`; invalid values, declaration-breaking input, and `url()`
render a transparent dot.
The light-DOM `<lr-option>` path normalizes its supported label/sub/dot/group fields to the same
internal row model.

When a local option is removed or becomes disabled, or an async response shrinks, an existing
keyboard-active row clamps to the nearest enabled survivor. If every row is disabled or removed,
`aria-activedescendant` clears; an untouched list with no active row remains untouched.

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
keystroke — the live as-you-typed search string, deliberately _not_ `value`, which is the committed
selection. It is the supported way to read that text; reaching into the shadow root for
`[part="combobox-input"]`'s value is not. Named `lr-filter` rather than `lr-input` precisely because
`lr-input`'s detail on `<lr-input>` is the committed value, and the two must not share a name while
carrying different strings. It fires for user edits only. Picking a row, `form.reset()`, dismissing
the listbox, a programmatic `value` write, and `setRangeText()` blank the filter silently.
Activating the clear button is a user edit: when a query existed it emits `lr-filter` with
`value: ''` before the clear transaction finishes.
`lr-show` and `lr-hide` report the start of listbox visibility transitions. `lr-show` is a
cancelable veto point; `lr-hide` is cancelable while connected, but the disconnect-driven close is
non-cancelable because an already-removed control cannot honour a veto. Vetoing a connected close
is atomic: the filter query, active option, async result rows, reflected `open` state, and overlay
ownership remain unchanged, so the host can defer dismissal without reconstructing the search.
`lr-after-show` and
`lr-after-hide` fire when the corresponding transition settles. `lr-create` carries
`detail: { inputValue }` and is also cancelable: preventing it suppresses the default append/select
action so the host can normalize and commit its own option.
The internal input's `focus` and `blur` are relayed exactly once from the host as owner-realm
native `FocusEvent`s. Both bubble, cross the shadow boundary, and preserve `relatedTarget`.
`lr-invalid` (no detail) is emitted once as a bubbling/composed, **cancelable** alias when native
validity fails — see "The validity alias is cancelable in 8.0.0" above.

**The clear button covers two axes, and announces only the one that moved.** A combobox owns both a
committed selection and an in-progress filter query, so the button renders whenever either has
something to clear, and one press clears both:

- Clearing a selection emits `input`, then `change`, then `lr-change`, then `lr-clear` — and, if the
  query was also non-empty, `lr-filter` with an empty `value`.
- A **query-only** clear (nothing selected, just typed text) emits `lr-filter` with an empty
  `value` and deliberately **no** `change` and **no** `lr-clear`. There was no selection
  transition to report, so announcing one would be a lie. Don't listen for `lr-clear` to detect
  "the user emptied the field" — listen for `lr-filter` when you care about the query.
- The query half of the render gate is scoped to states where the query is actually _visible_: an
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
- `clear-icon` and `expand-icon` replace the corresponding built-in glyphs.

**CSS parts:** `form-control`, `form-control-label`, `label`, `form-control-input`, `combobox`,
`start` and `end` (the two
adornment-slot wrappers, each `hidden` while nothing is slotted into it), `tags`, `tag`,
`tag-label`, `tag__content`, `tag__remove-button`, `tag__remove-button__base`, `combobox-input`,
`clear-button`, `expand-icon`, `listbox`,
`group-label` (the heading of an option group — rows sharing a `group` — named as on `lr-select` and
`lr-emoji-picker` so one rule styles every grouped list; it labels the `role="group"` wrapper here),
`option`,
`option-dot` (the leading status dot, when a row's `dotColor` is set), `option-icon` (the inert,
aria-hidden decorative leading visual for an async row), `option-start` and `option-end` (the inert,
aria-hidden adornments cloned from the source option's `start`/`prefix` and `end`/`suffix` slots, or
from an async row's `start`/`end`), `option-label`, `option-sub` (a row's
secondary line, when `sub` is set), `option-badge` (an async row's trailing metadata),
`option-overflow` (the "+N more" indicator from `maxRender`), `error`, `hint`

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the part is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-combobox-trigger-padding`,
`--lr-combobox-trigger-min-height`, `--lr-combobox-font-size`, `--lr-combobox-tag-padding`,
`--lr-combobox-tag-font-size`, `--tag-max-size` (default `var(--lr-size-5rem)`), `--show-duration`,
`--hide-duration`, and `--lr-combobox-expand-size` (the decorative icon box; each
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

**CSS custom states:** `blank`, `disabled`, `required`, `optional`, `valid`, `invalid`,
`user-valid`, and `user-invalid`.

**Optional peer deps:** none.

### `lr-option`

**Properties:**

- `value: string = ''`
- `disabled: boolean = false`
- `defaultSelected: boolean = false` (attribute `selected`; property writes do not reflect) — the
  declarative and `form.reset()` default. Changing it after mount updates the parent's reset
  baseline without overwriting a dirty live selection
- `selected: boolean = false` (property only) — live selectedness. The parent combobox/select
  updates it as the current value changes; those live writes never rewrite the `selected`
  attribute or `defaultSelected`
- `group: string = ''` (section header)
- `searchText: string = ''` (attribute `search-text` — extra text the filter matches beyond the
  visible label)
- `sub: string = ''` (optional secondary line rendered under the label, e.g. a status/date summary)
- `dotColor: string = ''` (attribute `dot-color` — optional CSS color for a small leading status
  dot; invalid values, declaration-breaking input, and `url()` render the dot transparently)
- `label: string` — settable WA-compatible plain-text label. A non-empty property/attribute wins;
  otherwise it resolves to `defaultLabel`. Property writes stay property-only (no reflection)
- `defaultLabel: string` (read-only) — normalized accessibility-visible text generated from the
  flattened default slot. Hidden subtrees are excluded, visible nested `aria-label` values replace
  their descendants, and `start`/`end`/`prefix`/`suffix` adornments are excluded. Direct and
  forwarding-slot mutations update the value and notify the owning picker

**Method:** `getTextLabel(): string` returns `defaultLabel`, preserving Shoelace's content-derived
plain-text contract even when a separate WA `label` override is present.

**Events:** `lr-option-change` — bubbles when the option's label or selectable data changes so
its parent `lr-combobox` or `lr-select` can refresh its normalized option rows. It is a private
child-to-parent refresh signal, not a picker event: the owning `lr-combobox`/`lr-select` consumes
it and stops it, so it never reaches a listener on the picker host (whose own contract is
`lr-change`/`lr-input`/`change`/`input`). Listen on the `<lr-option>` itself to observe it.

**Slots:** default (visible label), `start`/`end` (WA adornments), and `prefix`/`suffix` (Shoelace
aliases). `start` and `prefix` project into one leading wrapper; `end` and `suffix` project into one
trailing wrapper.

**CSS parts:** `base`, `checked-icon`, `label`, `start`/`prefix` (same node), and `end`/`suffix`
(same node). **CSS custom property:** `--current-text-color` (default `var(--lr-color-text)`) colors
the keyboard-current row. **CSS custom states:** `current` (the host is the roving-focus target),
`selected`, `disabled`, and `hover` (pointer presence, including drag sessions).

Own-anatomy state hooks are `--lr-option-hover-bg`, `--lr-option-active-bg`,
`--lr-option-current-bg`, `--lr-option-current-color`, `--lr-option-selected-font-weight`, and
`--lr-option-checked-icon-color`. Their defaults preserve brand-quiet hover/current paint, the
shared active mix, semibold selected text, and the brand checkmark. The current-color hook falls
back through upstream `--current-text-color`, so existing themes keep working.

The stock `lr-combobox` and `lr-select` intentionally treat each option as light-DOM data and
render normalized rows in their own shadow roots. Style those rows through the parent's `option`,
`option-label`, and related parts; the parts above style an option's own anatomy when it is rendered
by a custom owner.

```html
<lr-combobox id="cb" label="Country" placeholder="Search…" with-clear>
  <lr-option value="fr">France</lr-option>
  <lr-option value="de" search-text="deutschland">Germany</lr-option>
</lr-combobox>
<script type="module">
  document
    .getElementById("cb")
    .addEventListener("change", (e) => console.log(e.target.value));
</script>
```

```html
<!-- Async data source instead of light-DOM <lr-option> children: -->
<lr-combobox id="cb2" label="Fruit (async)" with-clear></lr-combobox>
<script type="module">
  document.getElementById("cb2").source = async (query) => {
    const rows = await fetchFruit(query); // your own lookup
    return rows.map((r) => ({
      value: r.id,
      label: r.name,
      icon: renderFruitIcon(r), // decorative; hidden from assistive technology
      badge: r.category,
      accessibleLabel: `${r.name}, ${r.category}`,
      data: r, // retained in cb2.selectedRows after selection
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
  kept on the input) is implemented correctly — a genuine strength, safe to build on.
  `<lr-option value="b" selected>` sets that option's `defaultSelected`, seeds the live selection,
  and supplies the `form.reset()` baseline, mirroring native `<select><option selected>`. A
  later-slotted option or post-mount `defaultSelected` change updates that baseline and updates the
  live selection only while it is pristine. A user pick or direct `option.selected` write makes the
  live selection dirty and never rewrites the declarative `selected` attribute/reset default.
- The floating listbox participates in Lyra's shared nonmodal overlay stack. Its computed
  `--lr-overlay-stack-index`, Escape owner, outside-pointer dismissal, and focus handoff follow the
  newest open Lyra overlay. Opening it above a color picker (or vice versa) therefore closes only
  the visual top layer per Escape/pointer action rather than both popups.

**Additional API surface:**

- `part="tag-label"` — The selected-tag label. Kept on one line and truncated with an ellipsis at `--tag-max-size` (default `var(--lr-size-5rem)`), rather than wrapped. Note that `lr-select`'s tag of the same name defaults to `var(--lr-size-12rem)`, so the same `--tag-max-size` value yields a wider tag there.

---

## `lr-select`

A plain closed-list dropdown — a direct `<lr-*>` counterpart to `<wa-select>`/`<wa-option>`.
**Form-associated** (hand-rolled internals, not the shared `FormAssociated` mixin — same reasoning
as `lr-combobox`, see the shared-foundation notes above). The trigger is a `<button>`, not a text
input: click/Enter/Space/ArrowDown opens it, and there's no typing-to-filter. Options are
`<lr-option value>` children — the same element `<lr-combobox>` uses — reconciled the same way
combobox does. The popup reuses `internal/positioner.ts` for placement and participates in Lyra's
shared nonmodal overlay stack.
Session-history/autofill restoration assigns the stored string through the same synchronous
value/form/validity path as a programmatic value write and does not emit `input`, `change`, or
`lr-change`.

There is no typing-to-filter and no `filter`/`source`/`empty-text`/`max-render` surface — reach for
`<lr-combobox>` instead whenever any of those apply. Everything else a closed list needs is here:
`multiple`, `max-options-visible`, `with-clear`, `getTag`, `placement`, `appearance`, and `pill`.

The trigger and its overlaid multi-select tag row accept constrained allocation. Long selected
labels ellipsize; long built-in tags wrap and cap their labels, so single and multiple selections
stay inside exact-320px LTR and RTL containers alongside start/end adornments.

**Multi-select (`multiple`, new in 8.0.0, default `false`).** Setting it re-shapes `value` from a
`string` into a `string[]` and renders one chip per selection. The `[part="tags"]` row is a sibling
overlaid on the real trigger, so every built-in tag remove button is valid independently-focusable
interactive content rather than a button nested inside another button. Picking a selected row,
Backspace/Delete on the focused trigger, and the `with-clear` action remain equivalent removal
paths. Selection identity is the option occurrence, not just its string: two same-valued rows may
both remain selected, render their own labels, submit duplicate entries, and be removed separately.
The trigger retains one genuinely visually-hidden current-value node containing **every**
selected label, even past `max-options-visible`; painted built-in chip labels and the overflow chip
are hidden from the accessibility tree so that value is announced once rather than truncated or
duplicated. Turning `multiple` back off collapses
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
When set and exactly one option is available (neither disabled nor inert, including through an
inert ancestor), the popup never opens at all: a click, Enter, Space, ArrowDown, or ArrowUp on the
trigger
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
- `open: boolean = false` (reflected). Direct or fieldset-cascaded disablement synchronously forces
  it closed; every later property or attribute attempt to open remains normalized to `false` until
  the control is enabled again
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
  `:hover` feedback. `lr-input` and `lr-textarea` use the same mapped `outlined` default.
- `pill: boolean = false` (reflected) — fully-rounded trigger corners. It changes the private
  radius default to `--lr-radius-pill`, so an inherited or direct `--lr-select-radius` remains
  authoritative
- `placement: Placement = 'bottom'` (reflected) — preferred listbox placement, from the
  Floating UI vocabulary (`'top'`, `'bottom-end'`, …). `flip`/`shift` may still move the popup to
  keep it in view, and the `left`/`right` component is swapped under RTL. Assignment while open
  refreshes positioning in place without closing, firing lifecycle events, or changing stack order
- `hoist: boolean = false` (reflected) — switches Floating UI from its mapped absolute strategy to
  fixed positioning, escaping clipping containers. It also switches live while open; an effective
  direction change refreshes logical left/right placement by the same path
- `filled: boolean = false` (reflected) — Shoelace alias for the filled trigger treatment
- `autofocus: boolean = false` / `title: string = ''` — forwarded to the internal trigger
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
- `helpText: string = ''` (attribute `help-text`) — Shoelace alias for `hint`; `hint` wins if both
  are present. `withLabel`/`withHint` (`with-label`/`with-hint`) are SSR slot-presence hints
- `getTag?: LyraSelectTagRenderer` (attribute: false) — `(option: LyraOption, index: number) =>
unknown`, exported under that name from the component's own module, renders one
  selected option's chip in `multiple` mode. Whatever it returns replaces the whole built-in
  `[part="tag"]` element, so re-declare `part="tag"` on your own root node to keep the default
  styling hooks. A returned **string renders as text, never as markup** (it lands in an ordinary
  Lit child position). A custom tag replaces the built-in remove control too, so it owns any custom
  removal affordance. Overflow past `max-options-visible` still collapses into the built-in "+N" chip
- `autoCommitSingleOption: boolean = false` (attribute `auto-commit-single-option`) — opts in to the
  single-option auto-commit behavior described above
- `value: string | string[]` — a getter/setter: a plain `string` in single mode (empty when nothing
  is selected), a `string[]` in `multiple` mode
- `defaultValue: string | string[]` (attribute `default-value` accepts the single string form) —
  reset selection; changing it updates the live value only while the control is pristine
- `selectedOptions: LyraOption[]` — a writable, fresh snapshot of the live selected occurrences.
  Assigning live child options commits their exact occurrences through the same event-silent path
  as `value`; foreign/detached options are ignored, and single mode keeps only the first. Mutating
  an array returned by the getter never mutates the control
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal trigger button.
`show()` and `hide()` return `Promise<void>` and resolve after `lr-after-show`/`lr-after-hide` once
the matching transition settles. `getForm()` returns the browser-resolved form owner, including an
external owner selected by `form`.
`setCustomValidity(message)` carries a rejection no client-side constraint can express ("that option
is no longer available"): a non-empty message raises `customError`, becomes `validationMessage`, and
blocks submission; `''` clears it and restores the control's own computed validity, so a `required`
select with nothing chosen goes back to `valueMissing` rather than to valid. The message survives
every selection change and a `form.reset()` — like a native control, only another
`setCustomValidity('')` or `resetValidity()` clears it — and is used verbatim, never localized.
`resetValidity()` changes only that consumer error layer: it restores the current intrinsic
required/selection validity without changing the selection/default or clearing prior interaction
state.

**Events:** each real selection change emits, in order, a native `InputEvent` named `input`,
`lr-input`, a native `Event` named `change`, then `lr-change`. The native events carry no detail;
read `event.target.value`. Both
prefixed aliases carry `detail: { value: string | string[] }` — the new committed selection, a string
in single mode and a `string[]` in `multiple` mode. The complete sequence is silent for a
programmatic `value` write, `form.reset()`, or session-state restoration. Plus
`lr-clear` (no detail; emitted by the `with-clear` button _after_ its
`input`/`lr-input`/`change`/`lr-change` run, and never when there was nothing to clear, so it never
announces a no-op),
`lr-show`, `lr-hide`, and bubbling, composed `focus`/`blur` events re-dispatched from the internal
trigger. `lr-show` is cancelable; `lr-hide` is cancelable while connected and
non-cancelable only for the disconnect-driven close, where a veto cannot be honoured. A direct or
fieldset-cascaded disablement is a policy closure rather than a user-requested transition: it
synchronously closes without the vetoable `lr-hide` or settled `lr-after-hide` lifecycle, and a
listener cannot hold a disabled popup open.
`lr-after-show` and `lr-after-hide` fire after the corresponding listbox transition has settled; an
interrupted transition drops its stale after-event.
`lr-invalid` (no detail, cancelable) fires when a validity check finds the control invalid.

**Slots:** default (`<lr-option>` children), `label`, `hint`, `help-text` (alias), `error` (overrides
the `errorText` attribute when provided), `start`/`prefix` (aliases before the selected-value label),
`end`/`suffix` (aliases after the label), plus `clear-icon` and `expand-icon`. Because the adornments
live inside the native trigger `<button>`, both wrappers are unconditionally inert,
`aria-hidden="true"`, and non-hit-testable. The names remain mirrored for decorative glyphs and
text, but links, buttons, inputs, and other supplied controls cannot become nested interaction or
accessibility stops.

In populated multiple mode, the trigger's `aria-describedby` first references the complete
visually-hidden selected-value node. When hint/error content is present it then references stable
shadow-local IDs for both messages (error before hint), so the current value and visible supporting
text are part of the focused control's accessible description.

**CSS parts:** `form-control`, `form-control-label`, `label`, `form-control-input`, `combobox`,
`trigger`, `display-input`, `start`, `prefix`, `end`, `suffix`, `tags` (the legal sibling
`multiple`-mode chip row), `tag`/`tag__base` (one selected-value chip), `tag-label`/`tag__content`,
`tag__remove-button`/`tag__remove-button__base`, and `tag-overflow` (the "+N" chip standing in for the selections past
`max-options-visible` — it carries **both** `tag` and `tag-overflow`, so `::part(tag)` styles every
chip while `::part(tag-overflow)` reaches only that one; state after `::part()` never matches, so it
is encoded in the part name instead), `clear-button` (the `with-clear` button, present only while
there is a selection to clear), `listbox` (the managed nonmodal popup, layered by
`--lr-overlay-stack-index` with `--lr-layer-dropdown` as its standalone fallback),
`group-label` (a heading row emitted inside the listbox whenever an option's `group` differs from
the previous one's — its stable ID labels a `role="group"` wrapper that semantically owns the
following option rows; options with an empty `group` get no heading or group wrapper),
`option`, `option-dot` (the leading status dot, when a row's `dotColor` is set), `option-label`,
`option-sub` (a row's secondary line, when `sub` is set), `expand-icon`, `error`, and
`hint`/`form-control-help-text` (compatibility names on the same supporting-text node).

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the part is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-select-trigger-padding`, `--lr-select-trigger-min-height`,
`--lr-select-font-size`, `--lr-select-expand-size` — all four have private defaults that follow
`size` (`xs`…`xl`), while inherited or direct public values remain authoritative; the same pattern
`lr-toast-item`'s `--lr-toast-padding`/`--lr-toast-font-size` use. `--lr-select-gap` (default
`--lr-space-xs`, the gap inside `[part='trigger']`) is retunable without a `::part(trigger)` rule
and does not vary by `size` — the adornment gap a field wants is looser than the icon-beside-label
gap the ladder is tuned for. `--lr-select-radius` (default `--lr-form-control-radius`, the corner
radius) is retunable the same way but _does_ follow the tier: the two tightest tiers take a smaller
radius, since a 6px corner on a 20px-tall control reads as a lozenge. `pill` changes its private
default to `--lr-radius-pill`. `--lr-select-tag-padding`
(default `var(--lr-space-2xs) var(--lr-space-xs)`) and `--lr-select-tag-font-size` (default
`var(--lr-font-size-sm)`) size a `multiple`-mode chip; like gap and radius their private defaults do
**not** vary by `size` tier, and inherited or direct public values win.
Mapped hooks `--tag-max-size` (default `var(--lr-size-12rem)`), `--show-duration`, and
`--hide-duration` cap one tag and independently retime the two popup directions.

The trigger's pointer/open states have component-scoped hooks too:
`--lr-select-trigger-hover-bg` (default `var(--lr-color-brand-quiet)` for the quiet appearances),
`--lr-select-trigger-active-bg` (default a deeper mix from the hover background), and
`--lr-select-open-border-color` (default `var(--lr-color-brand)`). Accent keeps its louder mixed
hover fallback when the hook is unset. These inline fallbacks let one select be rethemed without
changing the shared brand tokens used by other controls.

`--lr-select-trigger-min-height` is live at **every** tier, the default `m` included, where it is
`2.5rem` — byte-identical to `lr-input`'s and `lr-combobox`'s own `m` floor, so the three controls
agree at that tier. It used to be dead code: the component declared `--lr-select-trigger-height:
auto` on `:host`, and a _declared_ value (`auto` is one) wins over the `var()` fallback arm that
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
  document
    .getElementById("sel")
    .addEventListener("change", (e) => console.log(e.target.value));
</script>
```

```html
<!-- Multi-select with chips, a cap, and a clear button: -->
<lr-select
  id="tags"
  label="Labels"
  multiple
  with-clear
  max-options-visible="2"
  appearance="filled"
  pill
>
  <lr-option value="bug">Bug</lr-option>
  <lr-option value="docs">Docs</lr-option>
  <lr-option value="perf">Performance</lr-option>
</lr-select>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/select/select.js";
  const sel = document.getElementById("tags");
  // A custom chip: return a node, and re-declare part="tag" to keep the built-in styling hooks.
  sel.getTag = (option, index) => `${index + 1}. ${option.label}`; // a string renders as text
  sel.addEventListener("change", (e) => console.log(e.currentTarget.value)); // string[] in multiple mode
  sel.addEventListener("lr-clear", () => console.log("selection emptied"));
</script>
```

**Known gotchas:**

- The trigger keeps real DOM focus throughout — the listbox's "active" row is conveyed via
  `aria-activedescendant`, never actual focus, matching the WAI-ARIA "select-only combobox" pattern
  (as opposed to `lr-combobox`'s editable-input pattern).
- While open, live option reorders preserve the active row by option identity. Removing or
  disabling/inerting that option rehomes activity to the nearest available survivor (preferring the
  following row on a tie); removing every available option clears `aria-activedescendant`.
- One availability rule governs keyboard navigation, type-ahead, single-option auto-commit,
  pointer selection, and each proxy row's `aria-disabled`: an option is unavailable when it is
  disabled, inert itself, or inside an inert ancestor. Pointer activation of such a row is a no-op.
- The floating listbox participates in Lyra's shared nonmodal overlay stack. Its computed
  `--lr-overlay-stack-index`, Escape owner, capture-phase outside-pointer dismissal, and focus
  handoff follow the newest open overlay rather than DOM order. A single dismissal therefore closes
  only the visual top layer, even when target code stops pointer bubbling.
- No typing-to-filter, but a printable keypress still jumps to (while open) or directly selects
  (while closed) the next available option whose label starts with what's been typed, matching a
  native `<select>`'s own type-ahead; the buffer resets ~500ms after the last keystroke. In closed
  `multiple` mode the bounded search skips already-selected option occurrences and continues to a
  later unselected match, including a distinct row that carries the same public string value.
- `<lr-option value="b" selected>` sets that option's `defaultSelected`, seeds the live selection,
  and supplies the `form.reset()` baseline, mirroring native `<select><option selected>`. Later
  `defaultSelected`/attribute changes update that reset baseline without clobbering a dirty live
  selection; user picks and direct `option.selected` writes remain live-only and never rewrite the
  attribute/default.
- `aria-required` on the trigger reflects `required` immediately; `aria-invalid` only reflects once
  the trigger has been blurred (touched) at least once, mirroring `lr-combobox`'s own input.
  Blurring the trigger (Tab away) closes an open listbox, the same as a native `<select>`'s popup,
  without restoring focus and undoing the browser's native Tab/Shift+Tab destination.
- The trigger's accessible name now checks a host-level `aria-label` attribute first, before falling
  back to `label`/`placeholder`/`"Select"` — a plain `aria-label` on `<lr-select>` is no longer
  silently ignored. Precedence is presence-based: `aria-label=""` remains an explicit empty
  override rather than restoring any fallback.
- With `autoCommitSingleOption` set, a select with exactly one available option never exposes
  `role="combobox"`/opens a listbox at all — see "Single-option auto-commit" above.
  Testing/automation code that always expects a `role="combobox"` trigger, or that opens the
  listbox before asserting on a row, either needs at least two available options or should leave
  `autoCommitSingleOption` unset to observe the normal dropdown chrome.

---

## `lr-date-picker` / `lr-date-input` (+ `calendar-core.ts`)

Mirrors the `<wa-date-picker>`/`<wa-date-input>` 3.11 public API under `lr-`. Both
components are **experimental since 3.8**. Values use ISO 8601: `YYYY-MM-DD` (single) or
`YYYY-MM-DD/YYYY-MM-DD` (range).

The ISO model is proleptic Gregorian in every locale, including years `0000`–`0099` (no JavaScript
`Date` 1900 remap). Month/day names and visible day/week digits follow the effective locale while
formatters explicitly select the Gregorian calendar. `lr-date-input` uses locale `formatRange()`
for range presentation and normalizes locale digits plus bidi marks before parsing, so its own
Arabic/Persian display round-trips to the same ISO value.

### `lr-date-picker`

Inline month-grid calendar, not form-associated (used standalone or embedded inside
`lr-date-input`'s popover).

**Properties (28):**

- `dayContent` (JS only): `LyraDatePickerDayContent | undefined`
- `presets: LyraDateRangePreset[] = []` (JS only, new in 11.0.0) —
  `LyraDateRangePreset { label: string; start?: string; end?: string }`, where `start`/`end` are ISO
  `YYYY-MM-DD`. **Either bound may be omitted (new in 11.1.0)** to mean an OPEN bound, resolving to
  the picker's `min` / `max` respectively — that is how an "All time" preset is expressed. When the
  corresponding `min`/`max` is unset there is nothing to resolve to (a `value` of
  `YYYY-MM-DD/YYYY-MM-DD` has no unbounded spelling), so that preset's button renders **disabled**
  rather than looking live and doing nothing when pressed. Renders a `[part="presets"]` quick-range button row above the calendar, for the
  dashboard time-filter shape (Today / Last 7 days / Last 30 days / This month / All time).
  **Range mode only** — a preset names two dates, so it is ignored for a single-date picker rather
  than rendering a row that cannot do anything; unset renders nothing at all. Applying one commits
  through the same path a two-click selection uses, so the ISO serialization, the `min`/`max`
  clamping and the `input`-then-`change` pair are identical and a consumer's change handler cannot
  tell them apart. A reversed preset normalizes; a malformed one is ignored rather than clearing the
  current value, so a bad entry in a config-driven list never reads as "the user picked nothing".
  The active button carries `aria-pressed="true"` and `data-active`. Deliberately the same
  `label`/`start`/`end` shape as `<lr-time-range>`'s `TimeRangePreset`, so the library has one
  preset vocabulary rather than two — the only difference is the unit (ISO dates, not numbers)
- `appliedPreset: LyraDateRangePreset | undefined` (read-only, new in 11.1.0) — the preset whose
  button produced the current `value`, or `undefined` when the range was picked by hand. Read it
  inside your own `change`/`input` handler. It exists because a dashboard filter has to persist
  *which* preset is active rather than the pair it froze to: "Last 7 days" must still mean the last
  7 days after tomorrow's reload. That fact is not recoverable from `value` — re-deriving it by
  string-matching is the mapping table `presets` exists to delete, and it is ambiguous anyway
  (Today and This month coincide on the 1st of a month, and a hand-picked range can equal a
  preset's pair by construction). A property rather than an event detail because `input`/`change`
  here are **native** events, deliberately indistinguishable from a manual selection so existing
  handlers need no special case, and a native `Event` cannot carry a detail without changing type
- `disabled: boolean = false` (reflected)
- `disabledDates: string | string[] | Date[] = ''` (attribute `disabled-dates`)
- `disabledDaysOfWeek: string = ''` (attribute `disabled-days-of-week`)
- `disableFuture: boolean = false` and `disablePast: boolean = false` (reflected)
- `firstDayOfWeek: LyraDatePickerFirstDayOfWeek = 'auto'` (`'auto'|'sun'|'mon'|'tue'|'wed'|
'thu'|'fri'|'sat'`; attribute
  `first-day-of-week`, reflected)
- `focusedDate: string = ''` (attribute `focused-date`, reflected)
- `isDateDisabled?: (date: Date) => boolean` (JS only)
- `locale: string = ''` (reflected; malformed tags fall back to the platform locale)
- `max: string = ''` and `min: string = ''` (reflected ISO bounds)
- `maxRange: number = 0` and `minRange: number = 0` (attributes `max-range`/`min-range`, reflected;
  positive values count both range endpoints)
- `mode: 'single'|'range' = 'single'` (reflected; unknown values normalize to `single`)
- `months: 1|2 = 1` (reflected; finite values are truncated and clamped to `1..2`)
- `pageBy: 'months'|'single' = 'months'` (attribute `page-by`, reflected)
- `readonly: boolean = false` (reflected)
- `size: LyraSize = 'm'` (reflected; the shared `2xs`–`xl` ladder plus
  `small`/`medium`/`large` aliases)
- `today: string = ''` (reflected ISO override for deterministic today styling/constraints)
- `value: string = ''` (reflected)
- `valueAsDate: Date | null` and `valueAsRange: { from: Date|null; to: Date|null }` (JS-only
  accessors; setters are silent and normalize reversed ranges)
- `view: 'days'|'months'|'years'|'decades' = 'days'` (reflected)
- `weekdayFormat: 'narrow'|'short'|'long' = 'short'` (attribute `weekday-format`, reflected)
- `withOutsideDays: boolean = false` and `withWeekNumbers: boolean = false` (reflected)

Lyra retains the additive `previousLabel`/`nextLabel` localized accessible-label overrides and
the `selection` range getter.

**Methods:** `clear()`, `focus(options?)`, `goToToday()`, and
`goToDate(date: string | Date)`. Valid navigation dates are clamped to `min`/`max`; invalid values
are ignored.

**Keyboard:** The day grid uses one roving Tab stop. Month, year, and decade selection views do the
same: Arrow keys move through their four-column visual grid (with horizontal movement mirrored in
RTL), Home/End move to the first/last enabled period in the current page, and Enter/Space drills
into the focused period. Moving beyond a selection-grid edge opens the adjacent period page;
disabled periods never receive the roving focus. A period is enabled only when it contains at least
one date selectable under the active bounds, past/future limits, disabled dates/weekdays, predicate,
and pending-range limits; activating an unavailable period is a no-op.

**Events:** all are non-cancelable. `input` is a bubbling/composed native `InputEvent` (including
the first endpoint of a range); `change` is a bubbling/composed native `Event` for committed
values. `lr-focus-day` carries `{ date: Date }`, and `lr-view-change` carries `{ view, date }`.

**Slots:** `header`, `previous-icon`, `next-icon`, and `footer`. A dynamic
`day-YYYY-MM-DD` slot is also accepted as a Lyra extension and takes precedence over `dayContent`.

**Custom states:** `disabled`, `range`, and `readonly`.

**CSS parts (37):** `date-picker` / permanent compatibility name `base` (tokens on the same
visible shell; both names remain supported), `day`, `day-disabled`, `day-label`, `day-outside`,
`day-placeholder`, `day-range-end`, `day-range-inner`, `day-range-preview`, `day-range-start`,
`day-selected`, `day-today`, `day-weekend`, `footer`, `grid`, `header`, `month`, `month-label`,
`months`, `nav`, `next`, `previous`, `title`, `view-cell`, `view-grid`, `view-item`,
`presets` (the quick-range row), `preset-button` (one quick-range button; carries `data-active`
while its range is the current value),
`view-item-disabled`, `view-item-selected`, `view-item-today`, `view-row`, `weekday`, `weekdays`,
`weeknumber`, and `weeknumbers`. Lyra additionally retains the existing `week` part.

**Themeable custom properties:** `--lr-cell-size` (default `2.25rem`, controls day-cell/grid-column
size; its private default follows the `size` tier — `2xs`/`xs`/`s`/`l`/`xl`; `m` keeps the
default). An inherited or direct public value remains authoritative in every tier.

**Optional peer deps:** none.

### `lr-date-input`

Text field + calendar popover, **form-associated** via the shared `FormAssociated` mixin (`name`,
`value`, `disabled`, `required` all inherited).

**Properties (44):**

- `appearance: 'filled'|'outlined'|'filled-outlined' = 'outlined'` (reflected)
- `appliedPreset: LyraDateRangePreset | undefined` (read-only, new in 12.0.0) — the `presets` entry
  whose button produced the current `value`, or `undefined` when the value was picked on the
  calendar, typed into the field, cleared, or reset. Read it inside your own `change`/`input`
  handler; it is updated before those events are relayed, so a handler observes the preset that
  caused the very commit it is handling, and it is `undefined` while the popover has never been
  opened. Mirrors the nested `lr-date-picker`'s identically-named property across this component's
  shadow boundary, which is where the readback is actually needed: the compact
  text-field-plus-popover shape is the one a dashboard filter uses, the nested picker instance is
  unreachable from outside (a CSS part cannot yield it), and the fact is not recoverable from
  `value` — re-deriving it by string-matching is the mapping table `presets` exists to delete and is
  ambiguous anyway. A property rather than an event detail because `input`/`change` here are
  **native** events that cannot carry one
- `assumeInteractionOn: string[] = ['input']` (JS only)
- `autocomplete: string = ''`
- `dayContent?: LyraDatePickerDayContent` (JS only)
- `defaultValue: string = ''` (reset value; reflected through the `value` content attribute)
- `disabled: boolean = false`
- `disabledDates: string | string[] | Date[] = ''` and `disabledDaysOfWeek: string = ''`
- `disableFuture: boolean = false` and `disablePast: boolean = false` (reflected)
- `distance: number = 0` (reflected; finite offset from the anchor)
- `firstDayOfWeek: LyraDateInputFirstDayOfWeek = 'auto'` (reflected)
- `form: HTMLFormElement | null` (JS-only FACE owner)
- `hint: string = ''`
- `isDateDisabled?: (date: Date) => boolean` (JS only)
- `label: string = ''`
- `max: string = ''` and `min: string = ''` (reflected ISO bounds)
- `maxRange: number = 0` and `minRange: number = 0` (reflected; positive values include both
  endpoints)
- `mode: 'single'|'range' = 'single'` (reflected)
- `months: 1|2 = 1` (reflected; finite values are truncated and clamped)
- `name: string = ''` (reflected)
- `open: boolean = false` (reflected)
- `pageBy: 'months'|'single' = 'months'` (reflected)
- `pill: boolean = false` (reflected)
- `placement: LyraDateInputPlacement = 'bottom-start'` (reflected; all 12 side/alignment
  placements are accepted)
- `presets: LyraDateRangePreset[] = []` (JS only, new in 11.1.0) — forwarded verbatim to the nested
  `lr-date-picker`, whose own `presets` documents the semantics (range mode only, open bounds
  resolving to `min`/`max`, unset renders nothing). Forwarded rather than reimplemented because the
  picker lives in this component's shadow root, so a consumer has no route to it. The row's parts
  are re-exported as `presets`/`preset-button`, and `appliedPreset` above reports which entry
  produced the current value
- `readonly: boolean = false` and `required: boolean = false` (reflected)
- `size: LyraSize = 'm'` (reflected; `2xs`–`xl` and aliases)
- `today: string = ''` (reflected ISO override)
- `validationTarget: HTMLElement | undefined` (JS only) — writable native-validity focus anchor.
  It defaults to the internal input after first render; assign another element to override it, or
  assign `undefined` to restore the internal input
- `validators: LyraDateInputValidator[] = []` (JS only) — each entry may be a
  `(value, input) => void | boolean | string | ValidityStateFlags` function, an object with
  `validate(value, input)` returning that same result vocabulary, or a Web Awesome-compatible
  object with `checkValidity(input)`. The mapped object returns
  `{ isValid, message, invalidKeys }`, where `invalidKeys` names `ValidityState` flags; it may also
  expose `observedAttributes` and a string or callback `message`. Changing any listed host
  attribute automatically runs validity again. `isValid: true` passes. Otherwise the listed flags
  are set (`customError` is used when the list is empty) and the returned message wins over the
  validator-level fallback.
- `value: string = ''` (JS property)
- `valueAsDate: Date | null` and `valueAsRange: { from: Date|null; to: Date|null }` (JS-only
  accessors; setters are silent and normalize reversed ranges)
- `weekdayFormat: 'narrow'|'short'|'long' = 'short'` (reflected)
- `withClear: boolean = false`, `withHint: boolean = false`, and `withLabel: boolean = false`
- `withOutsideDays: boolean = false` and `withWeekNumbers: boolean = false` (reflected)

Lyra retains additive native-wrapper and form-chrome properties: `placeholder`, `locale`,
`errorText`, `accessibleLabel` (attribute `aria-label`), `clearLabel`, `openLabel`, `dialogLabel`,
`spellcheck`, `autocapitalize`, `autoCorrect` (attribute `autocorrect`), `inputMode: string = ''`
(attribute `inputmode`), `enterKeyHint: string = ''` (attribute `enterkeyhint`), and the reflected
`customError: string | null` (attribute `custom-error`). `withLabel` and `withHint` are SSR hints:
they force those slot wrappers into the first render so server output and hydration have the same
structure even before assigned-slot state is observable. The shared Lyra FACE contract also
reflects `disabled` and accepts a `form` content-attribute owner ID in addition to the
element-valued `form` IDL.

**Methods:** `blur()`, `clear()`, `focus(options?)`,
`formStateRestoreCallback(state)`, `hide()`, `resetValidity()`, `setCustomValidity(message)`, and
`show()`. The shared form contract additionally exposes `getForm()`, `checkValidity()`, and
`reportValidity()`; Lyra's native wrapper also exposes `click()`. `show()` and `hide()` return promises that settle after their corresponding transition;
they do nothing when already settled, and respect cancellation of their request event. `clear()`
is a no-op while blank, disabled, or readonly; otherwise it emits `lr-clear`, then `input`, then
`change`. Lyra also retains native-wrapper `select()`, `setSelectionRange()`, and `setRangeText()`.
The text input is itself the popup-opening combobox owner: it exposes `role="combobox"`,
`aria-haspopup="dialog"`, and explicit `aria-controls`/`aria-expanded` alongside the expand button.
Host focus/click/show/clear calls are synchronous no-ops as soon as direct or fieldset disablement
starts, including before Lit has updated the inner native controls.

**Getters:** `input: HTMLInputElement | undefined` — the internal native `<input>`, for direct DOM
access.

**Selection properties:** `selectionStart`, `selectionEnd`, and `selectionDirection` mirror the
internal native date input.

**Events:** `input` is an `InputEvent`, `change` is an `Event`, and `focus`/`blur` are
`FocusEvent`s preserving `relatedTarget`; each is dispatched exactly once from the host and is
bubbling, composed, and non-cancelable. `lr-show`/`lr-hide` are cancelable requests emitted before state changes;
`lr-after-show`/`lr-after-hide` are non-cancelable and fire after rendering and popup animations
settle. `lr-clear` is non-cancelable. `lr-invalid` **is** cancelable: `preventDefault()` on it
suppresses the browser's native validation bubble and `reportValidity()`'s focus/scroll of this
control, without making the control valid — see "The validity alias is cancelable in 8.0.0" above.

**Slots (10):** `clear-icon`, dynamic `day-YYYY-MM-DD`, `end`, `expand-icon`, `footer`, `hint`,
`label`, `next-icon`, `previous-icon`, and `start`. Lyra additionally retains `error`, which
overrides `errorText`.

The editable input shrinks first in a constrained row; `start` and `end` adornments are each
capped at 40% and ellipsize unbroken content. Clear and calendar actions retain their fixed target.

**Custom states:** `blank`, `disabled`, `open`, and `range`; the shared form-associated mixin also
exposes its validity states.

**CSS parts (21):** `clear-button`, `date-input`, `date-picker`, `presets` and `preset-button`
(forwarded from the nested `lr-date-picker` via `exportparts`, so the quick-range row is styleable
from outside — new in 11.1.0), `end`, `expand-button`,
`expand-icon`, `form-control`, `form-control-input`, `form-control-label`, `hint`, `input`,
`input-wrapper`, `popup`, `range-separator`, `segment`, `segment-literal`, `start`, permanent
compatibility name `base` (a nested wrapper inside `date-input`), and permanent compatibility name
`label` (the inner label-content wrapper inside `form-control-label`). Lyra additionally retains
`error`.

**Form value and validation:** a complete range submits `YYYY-MM-DD/YYYY-MM-DD`. A first range
endpoint remains visible in `value` but contributes the empty string to `FormData` until the second
endpoint is selected. `min`/`max`, past/future limits, disabled dates/weekdays, the predicate,
range length, `required`, and configured validators all feed FACE validity. Reset and state restore
use the same normalization path as direct property writes.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the part is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-date-input-padding-block` (default `--lr-space-xs`) and
`--lr-date-input-padding-inline` (default `--lr-space-s`) — the `input-wrapper`'s padding;
`--lr-date-input-font-size` (default `inherit`) — the `input` part's font size;
`--lr-date-input-control-min-height` (default `--lr-form-control-height`, i.e. `2.5rem` at the
default `m` tier) — the `input-wrapper`'s block-size
floor. Their private defaults follow `size` (`2xs`/`xs`/`s`/`l`/`xl`; `m` keeps the base defaults),
using the same per-`size` values `lr-input` uses. Inherited or direct public values win in every
tier. `pill` changes the private `--lr-date-input-radius` default to `--lr-radius-pill`; a public
radius still wins. Plus shared
tokens. The mapped `--show-duration` and `--hide-duration` hooks independently retime the popup's
enter and exit transitions; both default to `var(--lr-transition-fast)`.
The clear and calendar actions expose point-of-use state hooks:
`--lr-date-input-action-hover-color`, `--lr-date-input-action-hover-bg`, and
`--lr-date-input-action-hover-radius` (defaults: text, transparent, and the input radius), plus
`--lr-date-input-action-active-color`, `--lr-date-input-action-active-bg`, and
`--lr-date-input-action-active-radius` for the pressed state. They inherit from theme ancestors;
direct values on `lr-date-input` win without retuning library-wide tokens.

`--lr-date-input-control-height` pins an **exact** `input-wrapper` height (both floors and caps it).
It is **undeclared by default**, so the row grows to fit its content — see "exact-height hatches"
under `lr-input`. Pinning it _below_ the calendar toggle's 24×24 target is safe: the toggle keeps
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
<lr-date-input
  id="di"
  label="Start date"
  with-clear
  name="start"
></lr-date-input>
<script type="module">
  const di = document.getElementById("di");
  di.value = "2026-07-10";
  di.addEventListener("change", () => console.log(di.value)); // ISO string
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
  (`--lr-date-picker-selected-color`, defaulting to `--lr-color-on-brand`, not a hardcoded literal).
  Override selected background and foreground together to preserve contrast.

**Additional API surface:**

- `--lr-date-picker-month-gap` — Gap between visible months. Default: `var(--lr-space-l)`.
- `--lr-date-picker-header-gap` — Month-header child gap. Default: `var(--lr-space-s)`.
- `--lr-date-picker-radius` — Calendar and control corner radius. Default: `var(--lr-radius)`.
- `--lr-date-picker-nav-hover-bg` — Hover background of the previous/next month-navigation buttons.
  Default: `var(--lr-color-brand-quiet)`. An inline `var()` fallback rather than a `:host`
  declaration, and the rule wraps its selector in `:where()` so a consumer's own
  `::part(previous):hover` still wins without `!important`.
- `--lr-date-picker-nav-active-bg` — Pressed navigation background; defaults to the hover color
  mixed by `--lr-color-mix-active`.
- `--lr-date-picker-preset-hover-bg`, `--lr-date-picker-preset-active-bg`, and
  `--lr-date-picker-preset-selected-bg` (new in 11.0.0) — hover, pressed, and
  currently-selected paint for a `presets` quick-range button. Defaults are
  `var(--lr-color-brand-quiet)`, that hover colour mixed by `--lr-color-mix-active`, and
  `var(--lr-color-brand)` respectively.
- `--lr-date-picker-title-hover-color`, `--lr-date-picker-title-active-color`,
  `--lr-date-picker-title-active-bg`, and `--lr-date-picker-title-active-radius` — Month-title
  hover/press paint and pressed shape; defaults to brand, brand, brand-quiet, and
  `var(--lr-date-picker-radius)` respectively.
- `--lr-date-picker-day-hover-bg` and `--lr-date-picker-day-active-bg` — Day hover/press
  backgrounds; the pressed default mixes the hover hook by `--lr-color-mix-active`.
- `--lr-date-picker-day-outside-color`, `--lr-date-picker-today-outline`,
  `--lr-date-picker-disabled-color`, and `--lr-date-picker-disabled-opacity` — adjacent-month,
  today, and disabled-day paint; defaults preserve the quiet-text, brand, and shared disabled
  tokens.
- `--lr-date-picker-range-bg`, `--lr-date-picker-range-preview-bg`, and
  `--lr-date-picker-range-color` — range-interior, pending-preview, and adjacent-month range text
  paint. The preview defaults to the range background hook.
- `--lr-date-picker-selected-bg` and `--lr-date-picker-selected-color` — selected day and range
  endpoint paint; defaults to brand/on-brand.
- `--lr-date-picker-view-hover-bg`, `--lr-date-picker-view-active-bg`,
  `--lr-date-picker-view-selected-bg`, `--lr-date-picker-view-selected-color`,
  `--lr-date-picker-view-today-outline`, and `--lr-date-picker-view-disabled-opacity` — the
  corresponding month/year/decade selection-view states, independently themeable from day cells.
- `--lr-date-input-placeholder-color` — Placeholder text color. Default: `var(--lr-color-text-quiet)`.
- `--lr-date-input-gap` — Gap between input-row children. Default: `var(--lr-space-xs)`.
- `--lr-date-input-radius` — Input-row corner radius. Default: `var(--lr-radius)`.
- `--lr-date-input-focus-border-color` — Focused row border color. Default: `var(--lr-color-brand)`.

---

## `lr-textarea`

A multiline plain-text input primitive, form-associated (participates in native `<form>`
submission/validation/reset via `name`/`value`/`disabled`/`required`/`checkValidity()`/
`reportValidity()`). Ships an opt-in `label`/`hint`/`errorText` form-control chrome mirroring
`lr-select` -- left unset, none of it renders.

```html
<lr-textarea placeholder="Notes" rows="4"></lr-textarea>
<lr-textarea
  label="Bio"
  maxlength="280"
  with-count
  appearance="outlined"
  size="s"
  resize="auto"
></lr-textarea>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/textarea/textarea.js";
  const bio = document.querySelector('lr-textarea[label="Bio"]');
  await bio.updateComplete; // both calls are no-ops before the first render
  bio.scrollPosition({ top: 0 }); // pin a restored draft back to the top
  console.log(bio.scrollPosition()); // -> { top: 0, left: 0 }
</script>
```

### Properties

| Property                 | Attribute                  | Type                                                                 | Default      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                  | `value`                    | `string`                                                             | `''`         | The current text value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `defaultValue`           | `value` / `default-value`  | `string`                                                             | `''`         | Reset value. The Shoelace attribute alias and the native-style `value` content attribute share the same reset engine.                                                                                                                                                                                                                                                                                                                                                                                             |
| `rows`                   | `rows`                     | `number`                                                             | `4`          | Visible text rows (mapped default).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `resize`                 | `resize`                   | `'none' \| 'vertical' \| 'horizontal' \| 'both' \| 'auto'`           | `'vertical'` | Native CSS `resize` behavior, plus `'auto'` (`ResizeObserver`-driven grow-to-content, no manual handle). An invalid runtime value falls back to `'vertical'`; `'auto'` maps native CSS resize to `none`.                                                                                                                                                                                                                                                                                                          |
| `size`                   | `size`                     | `LyraSize`                                                           | `'m'`        | Visual size on the shared control ladder — the same scale as `lr-input`/`lr-select`/`lr-button`, and both spellings of every tier are accepted (`2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`). Governs the field's padding, font size and corner radius. Reflected.                                                                                                                                                                                                                                   |
| `appearance`             | `appearance`               | `'accent' \| 'filled' \| 'outlined' \| 'filled-outlined' \| 'plain'` | `'outlined'` | Visual treatment of the field. The mapped default draws a border without a fill; the other values share `lr-input`'s vocabulary. Reflected.                                                                                                                                                                                                                                                                                                                                                                       |
| `filled`                 | `filled`                   | `boolean`                                                            | `false`      | Shoelace alias for the filled treatment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pill`                   | `pill`                     | `boolean`                                                            | `false`      | Fully rounded field corners, matching `lr-input`'s/`lr-select`'s own `pill` — both upstreams ship it on their textarea, so a mechanical tag rename must not drop it. It changes the private radius default to `--lr-radius-pill`, so an inherited or direct `--lr-textarea-radius` stays authoritative. Most useful on a one- or two-row field: a tall multi-line surface with fully rounded ends wastes its first and last line's inline space, which is why it is opt-in rather than tied to `size`. Reflected. |
| `withCount`              | `with-count`               | `boolean`                                                            | `false`      | Renders a character count below the field, inside `[part="footer"]`. With `maxlength` set it counts _down_ the remaining characters instead of up from zero. Reflected.                                                                                                                                                                                                                                                                                                                                           |
| `placeholder`            | `placeholder`              | `string`                                                             | `''`         | Placeholder text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `readonly`               | `readonly`                 | `boolean`                                                            | `false`      | Native read-only behavior: prevents user edits while preserving focus, selection/copy, form submission, and silent programmatic editing methods. Reflected.                                                                                                                                                                                                                                                                                                                                                       |
| `label`                  | `label`                    | `string`                                                             | `''`         | Visible label text. Unset: no label chrome renders.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `hint`                   | `hint`                     | `string`                                                             | `''`         | Hint text below the field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `helpText`               | `help-text`                | `string`                                                             | `''`         | Shoelace alias for `hint`; `hint` wins when both are set.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `withLabel` / `withHint` | `with-label` / `with-hint` | `boolean`                                                            | `false`      | SSR slot-presence hints; neither is required for hydrated client-side slot detection.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `errorText`              | `error-text`               | `string`                                                             | `''`         | Error text below the field (overridden by slotted `error` content).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `customError`            | `custom-error`             | `string \| null`                                                     | `null`       | Reflected consumer-supplied validation message. A non-empty value blocks submission until `setCustomValidity('')` clears it.                                                                                                                                                                                                                                                                                                                                                                                      |
| `accessibleLabel`        | `aria-label`               | `string \| null`                                                     | `null`       | Accessible-name override forwarded to the internal `<textarea>`; every non-`null` value wins by presence—including an explicit empty string—over `label`, `placeholder`, and the localized default.                                                                                                                                                                                                                                                                                                               |
| `spellcheck`             | `spellcheck`               | `boolean`                                                            | `true`       | Forwarded to the native `<textarea>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `autofocus`              | `autofocus`                | `boolean`                                                            | `false`      | Forwarded to the native `<textarea>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `title`                  | `title`                    | `string`                                                             | `''`         | Forwarded to the native `<textarea>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `autocapitalize`         | `autocapitalize`           | `string`                                                             | `''`         | Forwarded to the native `<textarea>`; empty omits the attribute.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `autocorrect`            | `autocorrect`              | read: `boolean`; write: `boolean \| string`                          | `true`       | Forwarded to the native `<textarea>` (Safari/WebKit-specific). Reads are always boolean. Boolean writes preserve Web Awesome's IDL; Shoelace-compatible string writes normalize `off`/`false` to `false` and every other string to `true`. The HTML attribute uses canonical `on`/`off`. When the host attribute is absent and the state remains at its `true` default, the internal attribute is omitted so the browser keeps its default behavior.                                                              |
| `wrap`                   | `wrap`                     | `'hard' \| 'soft' \| 'off'`                                          | `'soft'`     | Native line-wrapping/submission behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `autocomplete`           | `autocomplete`             | `string`                                                             | `''`         | Forwarded to the native `<textarea>`; empty omits the attribute.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `inputMode`              | `inputmode`                | `string`                                                             | `''`         | Virtual-keyboard input hint forwarded to the native `<textarea>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `enterKeyHint`           | `enterkeyhint`             | `string`                                                             | `''`         | Virtual-keyboard Enter-key hint forwarded to the native `<textarea>`.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `minlength`              | `minlength`                | `number \| undefined`                                                | `undefined`  | Minimum text length; forwarded to the native `<textarea>` and reported as `validity.tooShort`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `maxlength`              | `maxlength`                | `number \| undefined`                                                | `undefined`  | Maximum text length; forwarded to the native `<textarea>` (which also stops typing past it) and reported as `validity.tooLong`.                                                                                                                                                                                                                                                                                                                                                                                   |
| `name`                   | `name`                     | `string`                                                             | `''`         | Form field name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `disabled`               | `disabled`                 | `boolean`                                                            | `false`      | Disables the control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `required`               | `required`                 | `boolean`                                                            | `false`      | Participates in native constraint validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

The lowercase native IDLs `inputmode: string` and `enterkeyhint: string` delegate to
`inputMode`/`enterKeyHint`; `autocorrect` is one public state with a boolean read type and a wider
cross-upstream write vocabulary.

**8.0 migration:** the former camel-case string property `autoCorrect` is not retained as a public
alias. Prefer boolean `autocorrect` writes in new code. A migrated Shoelace string write remains
valid (`'off'` and `'false'` read back as `false`; other strings read back as `true`), while markup
uses `autocorrect="on"` / `autocorrect="off"`.

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
  only for a value the _user_ edited, so the component recomputes both from its own `value` and
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
- The shared form-associated getters `form`, `getForm()`, `labels`, `validity`, `validationMessage`,
  `willValidate`, and `effectiveDisabled` are also available.

### Methods

| Method                                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus(options?)` / `blur()`                           | Focus or blur the internal native control.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `select()`                                             | Select all text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `setSelectionRange(start, end, direction?)`            | Set the native selection range and optional direction.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `setRangeText(replacement, start?, end?, selectMode?)` | Apply a native range edit, then synchronize the component `value`, form value, validity, and auto-grown size without emitting a user event.                                                                                                                                                                                                                                                                                                                                           |
| `scrollPosition(position?)`                            | Read or write the internal textarea's scroll offsets. Called with no argument it returns the current `{ top, left }`; called with a partial `{ top?, left? }` it writes only the axes present and returns `undefined`. Returns `undefined` either way before the internal textarea has rendered, and a non-finite offset leaves that axis alone. This is the one piece of scroll state no other public member reaches — use it to restore a draft, or to pin a long value to its end. |
| `setFormValue(value)`                                  | Set the reactive and submitted value synchronously.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `setCustomValidity(message)`                           | Set a consumer-supplied validation message. A non-empty message raises `customError`, becomes `validationMessage`, and blocks submission; `''` clears it and restores intrinsic required/length validity.                                                                                                                                                                                                                                                                             |
| `resetValidity()`                                      | Clear only consumer-supplied custom validity and recompute current intrinsic constraints. It does not change `value`/`defaultValue`, clear prior interaction state, or force an intrinsically invalid field valid.                                                                                                                                                                                                                                                                    |
| `checkValidity()` / `reportValidity()`                 | Run native constraint validation through `ElementInternals`.                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Events

| Event        | Detail              | Description                                                                                                                                                               |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`      | none                | Native-style composed event fired on every user-driven edit.                                                                                                              |
| `change`     | none                | Native-style composed event fired at native `change` timing.                                                                                                              |
| `lr-input`   | `{ value: string }` | Compatibility alias fired on every user-driven edit.                                                                                                                      |
| `lr-change`  | `{ value: string }` | Compatibility alias fired on native `change` timing (blur after a committed edit).                                                                                        |
| `blur`       | none                | Re-dispatched from the internal native `<textarea>`'s own `blur` -- bubbling and composed, unlike the native event.                                                       |
| `focus`      | none                | Re-dispatched from the internal native `<textarea>`'s own `focus`, for the same reason as `blur`.                                                                         |
| `lr-invalid` | none                | Fired when a validity check finds the control invalid. **Cancelable** — `preventDefault()` suppresses the native validation bubble and `reportValidity()`'s focus/scroll. |

Programmatic property assignments, selection changes, `setRangeText()`, form reset, and form-state
restoration are silent. User edits update `value`, submitted form data, and required validity before
the corresponding `lr-input`/`lr-change` event is dispatched. `form.reset()` restores the
original declarative `value`, matching native `defaultValue` behavior.

### Slots

| Slot        | Description                |
| ----------- | -------------------------- |
| `label`     | Custom label content.      |
| `hint`      | Custom hint content.       |
| `help-text` | Shoelace alias for `hint`. |
| `error`     | Custom error content.      |

### CSS Parts

| Part                                                                     | Description                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-control`                                                           | The outer wrapper around label, textarea, error and hint.                                                                                                                                                                                    |
| `form-control-label`                                                     | The `<label>` element.                                                                                                                                                                                                                       |
| `label`                                                                  | The visible label-content wrapper.                                                                                                                                                                                                           |
| `base` / `form-control-input` / `textarea-adjuster` / `textarea-wrapper` | Compatibility names on the plain block wrapper around the native `<textarea>`. It deliberately imposes no size of its own — the native resize grip writes inline `width`/`height` onto the `<textarea>` itself, so the field drives the box. |
| `textarea`                                                               | The native `<textarea>` element.                                                                                                                                                                                                             |
| `footer`                                                                 | The row below the field carrying the character count. Always in the DOM but `hidden` without `with-count`.                                                                                                                                   |
| `count`                                                                  | The character count text, rendered only with `with-count`.                                                                                                                                                                                   |
| `hint` / `form-control-help-text`                                        | Compatibility names on the hint message.                                                                                                                                                                                                     |
| `error`                                                                  | The error message.                                                                                                                                                                                                                           |

The visible `[part="count"]` is `aria-hidden`; the internal shadow `.count-announcement` node is
also an `aria-hidden` mirror (it is not a public CSS part), while the debounced spoken update is
appended to the shared light-DOM
`[data-lr-live-region="polite"]` sink about a second after the user stops typing. A screen reader is
therefore not told the count on every keystroke, and the announcement remains reliable across the
shadow boundary. The sink stays silent while the textarea or a composed ancestor is hidden, inert,
`aria-hidden`, or hidden by rendered CSS. Lengths count UTF-16 code units (one emoji counts as two),
matching the native `maxlength` the count reports against, and the remaining count floors at zero — only a
script-assigned value can exceed `maxlength`, and the `tooLong` validity flag already reports that
state better than a negative number would. An unparseable `maxlength` (`maxlength="oops"`) is
dropped rather than rendered as `NaN`, and the count counts up from zero instead.

`required` with a non-empty `label` paints the library's shared marker on `form-control-label` —
the one `::after` rule described under "The required-field marker" above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the part is hidden and no glyph is painted.

### Themeable custom properties

- `--lr-textarea-max-block-size` (default `none`) — bounds `resize="auto"`; content beyond the
  bound scrolls inside the native textarea. Auto-resize remeasures after user edits, programmatic
  `value`/`rows` changes, range edits, and container-width changes.
- `--lr-textarea-padding` (default `var(--lr-form-control-padding-inline)`),
  `--lr-textarea-font-size` (default `var(--lr-form-control-font-size)`) and
  `--lr-textarea-radius` (default `var(--lr-form-control-radius)`) — the native textarea's padding,
  font size and corner radius. All three read the active `size` tier of the shared control ladder,
  so their private defaults follow the tier; the two tightest tiers take a smaller radius. Public
  values inherited from an ancestor or set directly on the host win in every tier. `pill` changes
  the private `--lr-textarea-radius` default to `--lr-radius-pill`.
- `--lr-textarea-fill` (default `transparent`) and `--lr-textarea-border-color` (default
  `var(--lr-color-border)`) — the field's background and border color, whose private defaults
  change per `appearance` rather than per `size`. The documented defaults are
  `appearance="outlined"`'s private values. Set either on an ancestor or directly on the host to
  retune the surface without a `::part(textarea)` rule; the public value remains authoritative
  across appearances.
- `--lr-textarea-hover-border-color` (default `var(--lr-color-brand)`) — the field border while the
  native textarea is hovered, independent of its resting border and every other brand-colored
  component state.

**Additional API surface:**

- `click()` — Activates the internal textarea.

---

## `lr-button`

A generic action-button primitive. Renders an internal native `<button>`; `type="submit"`/
`type="reset"` are handled by the component itself via its browser-resolved form owner (including
an external owner named by `form`), since a shadow-internal native button doesn't participate in a
light-DOM form's submission on its own. They remain default actions of the composed native
`click`: `preventDefault()` from any listener on that click path vetoes submit/reset before it
runs, while `stopPropagation()` alone does not. Canceling the form's later `submit` or `reset`
event remains an independent veto point.

Set `href` to a safe link URL and the root renders as a real `<a part="base" href=…>` instead — a
link styled as a button (e.g. a CTA). Native navigation is then the activation, so the submit/reset
handling and `type` have no effect in that mode. A disabled link button (its own `disabled` or an
ancestor `<fieldset disabled>`) renders the anchor with `aria-disabled="true"` and **no `href`**, so
it is neither focusable nor navigable; it also dims to `--lr-opacity-disabled` with a `not-allowed`
cursor and no hover/press feedback, exactly like the disabled `<button>` path (an `<a>` can never
match `:disabled`, so that arm of the styling keys off `aria-disabled` instead). An
unsafe/unparseable `href` falls back to the native `<button>`.

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
  (e.g. `'_blank'`) automatically force-adds `noopener noreferrer` to the rendered anchor's
  relationship tokens. Ignored in `<button>` mode
- `rel?: string` — independently settable native relationship tokens with no default. Author tokens
  such as `nofollow`, `me`, `license`, `external`, and `tag` are preserved on same-tab and targeted
  links. `opener` is always stripped, and whenever `target` is set the non-removable
  `noopener noreferrer` floor is merged in. When neither `target` nor author tokens are present the
  anchor omits `rel`
- `download?: string` — native anchor `download` attribute, used only while `href` resolves to a
  link. Presence remains meaningful when the value is empty: `download=""` derives a filename and
  still selects the stricter downloadable-URL policy. Ignored in `<button>` mode
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected). Reads
  stay in Lyra's shared vocabulary; migrated Shoelace inputs normalize `default` → `neutral`,
  `primary` → `brand`, and `text` → neutral `appearance="plain"`. The Lyra/Web Awesome default is
  intentionally still `neutral`
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
- `pill: boolean = false` (reflected) — fully rounded ends. It changes the private radius default
  to `--lr-radius-pill` rather than declaring a radius on `[part="base"]`, so an inherited or
  direct `--lr-button-radius` remains authoritative. `appearance="link"` renders with zero chrome,
  pill or not
- `circle: boolean = false` (reflected) — Shoelace-compatible circular icon-button treatment: a
  square control with the pill radius and compact inline padding. It is additive to, not a rename
  of, `pill`. Circle and automatically detected icon-only buttons retain the shared
  `--lr-icon-button-size` minimum clickable box at every `size`; the tier still scales their glyph
  and chrome
- `outline: boolean = false` (reflected) — Shoelace-compatible outlined treatment. It does not
  overwrite `appearance`, so removing `outline` restores the canonical Lyra appearance
- `withCaret: boolean = false` (attribute `with-caret`, reflected) — renders a decorative trailing
  chevron (`[part="caret"]`, `aria-hidden`) marking the button as a dropdown/menu trigger. It
  carries no accessible name of its own: the button's label already names the action, and the popup
  relationship is expressed by a host `aria-haspopup`/`aria-expanded`, which are forwarded to the
  internal control. Like the label and the two adornment slots it fades to `opacity: 0` while
  `loading`, so the spinner has the button to itself
- `caret: boolean = false` (attribute `caret`, reflected) — Shoelace alias for `withCaret`; either spelling renders the same part
- `withStart: boolean = false` / `withEnd: boolean = false` (attributes `with-start`/`with-end`) —
  Web Awesome SSR presence hints that keep the matching adornment wrapper mounted before slot
  assignment is observable
- `type: 'button' | 'submit' | 'reset' = 'button'`
- `loading: boolean = false` (reflected) — shows an internal spinner and disables the button without
  clearing `disabled`
- `disabled: boolean = false` (reflected)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name forwarded
  reactively to the internal native button or anchor; changing or removing the attribute after
  mount updates the actual focused control
- `required: boolean = false` (reflected), `validity`, `validationMessage`, and `willValidate` —
  Web Awesome's form-validity surface. A required button needs a non-empty submitter `value`; this
  validation never makes the button a persistent form-data entry. Disabled, loading, and actual
  anchor modes clear effective validity while retaining intrinsic/custom state for restoration
- `customError: string | null` (attribute `custom-error`, reflected) — consumer validation message

**Submitter overrides (`type="submit"` in `<button>` mode).** `name`/`value` plus the five native
`form*` overrides describe the submission this button triggers, not the button itself:

- `formAction?: string` (attribute `formaction`) — overrides the form owner's `action`. Unset leaves
  the form's own action in place; an explicitly present empty string is forwarded and follows
  native resolution against the current document
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
one. While that stand-in exists it _is_ the form's submitter, so **`SubmitEvent.submitter` is the
transient native button, not this host**. With none of those properties set, submission stays a
plain `requestSubmit()` with a `null` submitter, and all of it is inert in link mode.
For each string override, presence rather than truthiness chooses the transient path and its raw
attribute is copied, so explicit empty values remain distinguishable from absence. Only the
canonical native/upstream spellings are supported; the former hyphenated Lyra aliases were
removed.

Each size tier's `min-block-size` floor is exposed as its own token (see below).

**Getters/methods:** `click()`, `focus(options?)`, and `blur()` — forwarded to the internal base
element (the `<button>`, or the `<a>` in anchor mode); `click()` also runs the component's
submit/reset behavior in `<button>` mode. `getForm()` returns the browser-resolved form owner,
including an external owner selected by the `form` attribute. `checkValidity()`, `reportValidity()`,
and `setCustomValidity(message)` delegate to `ElementInternals`; `resetValidity()` clears only the
consumer error and restores the current `required`/`value` constraint. `formStateRestoreCallback()`
restores `value` for session history/autofill without changing submitter-only form-data semantics.

**Events:** a plain native `click` bubbles and composes through the shadow boundary unmodified
(disabled while `disabled` or `loading`). In button mode, submit/reset runs only after that click's
listener path has accepted the default action; calling `preventDefault()` on the host or an
ancestor therefore vetoes it, while propagation control by itself does not. The internal button's
`focus` and `blur` — which do not
cross the shadow boundary on their own — are re-dispatched from the host as bubbling, composed
events. `lr-invalid` (no
detail, cancelable) fires when a validity check finds the button invalid; `preventDefault()` on it
suppresses the native validation bubble and `reportValidity()`'s focus/scroll.

**Slots:** default (label content), `start` (leading icon/content), `end` (trailing icon/content),
plus Shoelace aliases `prefix` → `start` and `suffix` → `end`.

In a constrained button the default label ellipsizes and each adornment wrapper is capped at 40%
of the control. Fixed icons remain visible while unbroken labels or metadata cannot widen the row.

**CSS parts:** `base` (compatibility name for the internal control; use `button`),
`button` (the internal native `<button>`, or an `<a>` when `href` resolves to a safe link; it is
the same node as `base`), `label`, `start`/`prefix` (the same wrapper), `end`/`suffix` (the same
wrapper), `caret` (the decorative dropdown chevron, present only while either caret spelling is
set), `spinner` (present only while `loading`).

**CSS custom states:** `disabled` (including fieldset-disablement and loading), `icon-button`
(one text-free default-slot element), `link` (safe anchor mode), and `loading`.

**Themeable custom properties.** The colour slots below are re-pointed at the active `variant`'s row
of the library's shared semantic colour grid, so the component carries no `:host([variant='…'])`
block of its own — the ones marked variant-independent are the exceptions:

- `--lr-button-accent` (default `--lr-color-fill-loud`) — text/glyph colour for the chrome-less
  tiers (`outlined`, `plain`, `link`), i.e. the variant's loud fill borrowed as a foreground.
  `variant="neutral"` is the one exception: its loud fill is a mid grey picked to carry _light_
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
  `appearance="outlined"` _and_ `"filled-outlined"`, overriding `--lr-button-border`. Deliberately
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
button is the same height as an input, select, combobox or date input of the same tier _by
construction_ rather than by two hand-maintained lists agreeing — which is exactly how they drifted
apart before 8.0.0. Each is read only by its own tier (`--lr-button-size-s` also serves
`size="small"`, and so on for the other two aliases), and all are ignored by `appearance="link"`.
Retheming `--lr-theme-form-control-height-*` moves every control on the ladder together.
Circle and automatically detected icon-only buttons add the shared `--lr-icon-button-size` floor
on both axes, so the compact `2xs`/`xs` tiers cannot collapse those standalone targets below 40px.
Ordinary labelled buttons keep the exact shared form-control ladder heights above.

`--lr-button-gap` (default `--lr-form-control-gap`, the gap between the icon/label and any slotted
content) does not vary by tier. `--lr-button-radius` (default `--lr-form-control-radius`, the corner
radius) _does_ follow the tier — the two tightest tiers take a smaller radius, since a 6px corner on
a 20px-tall control reads as a lozenge. Both are inheritable and retunable without a
`::part(base)` rule; `appearance="link"` ignores the radius (it renders with zero), and `pill`
changes its private default to `--lr-radius-pill`. `--lr-button-caret-size` (default
`var(--lr-size-0-75em)`) is the `with-caret`
chevron's font size — declared in `em`, so it tracks every `size` tier through the button's own font
size instead of needing a per-tier value.
`--lr-button-shadow` is **undeclared by default**, so `box-shadow` falls back to `none` —
byte-identical to before this property existed — set it to add a drop shadow (e.g. an
elevated/floating action button) without a `::part(base)` rule.

**Retuning one `size` tier's geometry, without a `::part(base)` rule.** Four more properties carry
the active tier's geometry. Every `:host([size='…'])` rule changes only private defaults — no
per-tier rule redeclares a public hook or styles `[part='base']` directly. An inherited or direct
public value therefore retunes whatever tier is active (e.g. pinning a `size="s"` button into a compact toolbar row), the same
pattern `lr-input`/`lr-select`/`lr-combobox`/`lr-segmented`/`lr-date-input` follow. Each defaults to
the shared ladder's value for the active tier, which at the default `m` tier resolves to the values
in brackets:

- `--lr-button-padding-block` (default `--lr-form-control-padding-block`; `--lr-space-xs` at `m`)
- `--lr-button-padding-inline` (default `--lr-form-control-padding-inline`; `--lr-space-m` at `m`)
- `--lr-button-font-size` (default `--lr-form-control-font-size`; `--lr-font-size-m` at `m`)
- `--lr-button-min-height` (default `--lr-form-control-height`) — the active tier's `min-block-size`
  floor. Its private default follows that tier's own `--lr-button-size-*` token, and it is used as the
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
<lr-button appearance="plain" aria-label="Close dialog"
  ><svg slot="start">...</svg></lr-button
>
<p>
  The message failed.
  <lr-button appearance="link" variant="brand">Retry</lr-button>
</p>

<lr-button pill with-caret aria-haspopup="menu" aria-expanded="false"
  >Actions</lr-button
>
<lr-button variant="primary" outline caret
  ><span slot="prefix">★</span>Migrated</lr-button
>
<lr-button circle aria-label="Settings"
  ><svg aria-hidden="true">...</svg></lr-button
>

<form action="/save" method="post">
  <lr-input name="title" label="Title" required></lr-input>
  <lr-button
    type="submit"
    name="intent"
    value="draft"
    formnovalidate
    formaction="/save-draft"
  >
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

An accessible icon-only action/link with a native `<button>` inside. It is deliberately not a
form-associated submitter; use `<lr-button circle type="submit|reset">` with an icon-only default
slot when a form action is required.

Its public `--lr-icon-button-*` theme inputs stay undeclared on the host, so an ancestor theme
wrapper can override the built-in fallbacks; a value set directly on the element still wins.

**Properties:**

- `icon: string = ''` — an `lr-icon` glyph name (see `llms/components/lr-icon.md`)
- `name: string = ''` — Shoelace alias for `icon`; reads and writes stay synchronized. Assigning
  the upstream `undefined` spelling clears both names to the canonical `''` read value
- `library?: string` / `src?: string` — forwarded to the nested `lr-icon`, preserving Shoelace
  icon-library and remote-SVG markup. Remote SVG loading inherits `lr-icon`'s URL, byte-ceiling,
  sanitization, and stale-generation guards
- `accessibleLabel: string = ''` (attribute: `aria-label`) — the typed override for the button's
  accessible name; wins over `label`
- `label: string = ''` — accessible name when `accessibleLabel` is unset
- `disabled: boolean = false` (reflected)
- `href?: string`, `target?: string`, `download?: string` — a safe `href` renders a native anchor;
  `target` derives `rel="noopener noreferrer"`, and download presence (including `download=""`)
  selects the stricter downloadable-URL allowlist. A disabled link keeps the anchor but removes
  `href`

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

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the native interactive root,
activating the action button or a safe anchor through the same path as pointer/keyboard input.

**Events:** a plain native `click` crosses the shadow boundary unmodified. The internal button's
`focus` and `blur` are re-dispatched from the host as bubbling, composed events.

**Slots:** (default) — custom icon content. It is rendered **beside** the `icon` glyph, as a
sibling of it, not piped through `<lr-icon>`: the internal `<lr-icon>` mounts only when `icon` is
set, so with `icon` left empty your content is the button's only child. That is what lets a
complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — render at its own natural aspect ratio
instead of being forced into a 1:1 box. Setting both `icon` and slotted content renders both, side
by side; that is a valid composition, not a fallback.

**Bare SVG geometry fallback:** slotted bare SVG _geometry_ (`path`, `circle`, `rect`, `line`,
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

**CSS parts:** `base`/`button` (the same native button or anchor), `fallback` (only present in the
DOM while at least one top-level slotted element needs the bare-geometry fallback above)

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
  `var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))`) — the _complete_ native
  border shorthand, replaced wholesale in each state rather than merged.

These are the same per-component indirection `lr-button`'s
`--lr-button-fill`/`--lr-button-on-fill` provide, letting a single button be bordered and tinted
without a `::part(button)` rule. All nine are undeclared by default and read as inline `var()`
fallbacks, so setting only the resting value carries through hover and press, and setting none of
them leaves rendering unchanged.

```html
<lr-icon-button name="search" library="default" label="Search"></lr-icon-button>
<lr-icon-button
  name="chevron-right"
  label="Open documentation"
  href="https://example.com/docs"
  target="_blank"
></lr-icon-button>
```

## `lr-input`

A single-line plain-text input primitive, the `lr-*` equivalent of a plain `wa-input`,
form-associated via the same `FormAssociated` mixin as `lr-textarea`. Ships the same opt-in
`label`/`hint`/`errorText` form-control chrome as `lr-textarea`/`lr-select`, and the same
`size` scale as `lr-select`/`lr-combobox`.

Pressing Enter submits the ancestor `<form>` — the implicit submission a native `<input>` performs;
see "Enter-to-submit" below for the exact rules and for which controls deliberately opt out.

Public `--lr-input-*` theme inputs stay undeclared on the host, so an ancestor theme wrapper can
override size, appearance, and pill fallbacks; a value set directly on the element still wins.
When a clear or password action is present, `2xs` through `m` grow only enough to contain its
shared hit target (42px including the row border at the default theme); `l` and `xl` retain their
48px and 56px shared control heights.

**Properties:**

- `type: LyraInputType = 'text'` — `'text' | 'password' | 'email' | 'number' | 'time' | 'search' |
'date' | 'datetime-local' | 'tel' | 'url'`. Unsupported attribute or direct-property strings
  normalize to reflected `text` before native validity and type-dependent chrome are projected
- `size: LyraSize = 'm'` (reflected — see "Shared form vocabulary" below)
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'`
  (reflected) — the shared field-surface vocabulary. `outlined` (the mapped default) draws a border
  without a fill; `filled-outlined` draws both, `filled` drops the border, `plain` drops
  both, and `accent` tints both with the brand color. Each value does nothing but swap
  `--lr-input-fill`/`--lr-input-border-color`, so either can be retuned without a
  `::part(input-wrapper)` rule
- `filled: boolean = false` (reflected) — Shoelace alias for the filled treatment
- `pill: boolean = false` (reflected) — rounds the control row to a full pill by swapping
  `--lr-input-radius` to `--lr-radius-pill`
- `autofocus: boolean = false` — forwarded to the internal native `<input>` rather than left on the
  host, so the browser's own autofocus algorithm targets the real text control (the custom-element
  host is not focusable). Left unset, the native attribute is omitted entirely
- `value: string = ''` (from `FormAssociated`)
- `defaultValue: string = ''` — reset value, backed by the standard `value` content attribute;
  `default-value` is accepted as a Shoelace attribute alias
- `name: string` (from `FormAssociated`) and the plain inherited `id` are both forwarded to the
  internal native `<input>` (previously the internal input carried neither, only a fixed
  `id="input"`), so shadow-DOM-aware password managers that key field detection off the actual
  control's own `name`/`id` — not `autocomplete` alone — recognize `<lr-input>` fields. The
  internal `<label for>` tracks whichever id is in use. Leaving `id` unset on the host keeps the
  internal input at `id="input"`, identical to before
- `placeholder: string = ''`
- `clearable: boolean = false` (reflected) — shows a localized clear action while a `text` or
  `search` input has a value; clearing preserves input focus
- `withClear: boolean = false` (attribute `with-clear`) — Web Awesome's spelling of `clearable`;
  either one shows the same action. Inherited by `lr-number-input` and `lr-time-input`, where it is
  inert for the same reason `clearable` is (neither type renders a clear action)
- `readonly: boolean = false` (reflected) — forwarded to the native input and disables clearing
- `label: string = ''`
- `hint: string = ''`
- `helpText: string = ''` (attribute `help-text`) — Shoelace alias for `hint`; `hint` wins when both
  are set. `withLabel`/`withHint` (`with-label`/`with-hint`) provide optional SSR slot-presence hints
- `errorText: string = ''` (attribute `error-text`)
- `accessibleLabel: string | null = null` (attribute `aria-label`)
- `autocomplete: string = ''`
- `title: string = ''` — forwarded to the native input
- `spellcheck: boolean = true` — forwarded to the native input, including `spellcheck="false"`
- `autocapitalize: string = ''` / `autocorrect` (read: `boolean = true`; write:
  `boolean | 'off' | 'on'`; attribute values `on`/`off`)
- `inputMode: string = ''` (attribute `inputmode`) / `enterKeyHint: string = ''` (attribute
  `enterkeyhint`) — `autocapitalize`, `inputMode`, and `enterKeyHint` are forwarded verbatim to the
  native input and an empty string omits them; `autocorrect` is normalized to canonical `on`/`off`
- Lowercase native IDLs `inputmode: string` and `enterkeyhint: string` delegate to the camel-case
  native properties; `autocorrect` reads as boolean while accepting both Web Awesome's boolean
  writes and Shoelace's `'off'`/`'on'` writes

**8.0 migration:** the former camel-case string property `autoCorrect` is not retained as a public
alias. Prefer boolean `autocorrect` writes in new code; migrated Shoelace `'off'`/`'on'` property
writes remain valid and read back as booleans. Markup uses `autocorrect="on"` /
`autocorrect="off"`.

- `min?: number | string` / `max?: number | string` (attributes `min`/`max`) /
  `step?: number | 'any'` (attribute `step`, accepts the native `'any'` value alongside a number)
  — forwarded verbatim to the native
  input and validated by it. Intended for `type="number"`; `step` is equally meaningful on
  `type="time"`. On `lr-input` itself the `min`/`max` _attributes_ are number-converted, so a
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
- `noSpinButtons: boolean = false` (attribute `no-spin-buttons`) — Shoelace alias for
  `withoutSpinButtons`; either suppresses native number spinners
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
The shared form surface also exposes `getForm()`, which returns the browser-resolved owner including
an external form selected by the `form` attribute. `resetValidity()` clears only consumer-supplied
custom validity and recomputes the current native/required constraints; it leaves
`value`/`defaultValue` and prior interaction state unchanged, so an intrinsically invalid input
stays invalid.

Three more native passthroughs:

- `valueAsDate: Date | null` / `valueAsNumber: number` — native getters/setters for date/time and
  numeric input types. Assignment synchronizes `value`, form value, and validity without emitting a
  user edit event; unsupported types retain the native `null`/`NaN` behavior.

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
  `<lr-number-input>`'s stepper buttons build on these and _do_ emit, because a button press is a
  user edit.

**Events:** native-style composed `input` and `change`, plus `lr-input` (`detail: { value }`,
fired on every user-driven edit) and `lr-change` (`detail: { value }`, fired on the native
`change` timing), `blur`/`focus` (re-dispatched bubbling + composed from the internal native input's
own `blur`/`focus`), and
`lr-clear` (no detail, fired after the clear action's `input`/`lr-input`/`change`/`lr-change`
sequence). `lr-invalid` (no detail) fires when a validity check finds the input invalid.

**Slots:** `label`, `hint`/`help-text`, `error`, `start`/`prefix` (aliases before the input),
`end`/`suffix` (aliases after the input and built-in actions), `clear-icon`,
`show-password-icon`, and `hide-password-icon`.

**CSS parts:** `form-control`, `form-control-label`, `label`, `base`/`form-control-input`/
`input-wrapper` (compatibility names on the row wrapping the native input and actions), `input`,
`password-toggle`, `password-toggle-button`
(present only when `type="password"` **and** `password-toggle` is set), `start`, `end`,
`prefix` (alias of `start`), `suffix` (alias of `end`),
`clear-button` (non-empty clearable `text`/`search` inputs only),
`hint`/`form-control-help-text` (compatibility names on the same hint node), and `error`.
Long `start`/`end` adornments shrink and ellipsize inside their flex allocation rather than
widening a narrow field; label, hint, and error text wrap at unbroken boundaries. The
`Narrow RTL (320px)` story exercises both adornments with a clear action and localized long copy.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described under "The required-field marker"
above, and the reference implementation every other labelled control in the library shares, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it. With no label text the part is hidden and
no glyph is painted.

**Themeable custom properties:** `--lr-input-padding-block`, `--lr-input-padding-inline`,
`--lr-input-font-size`, `--lr-input-control-min-height` — all four have private defaults that follow
`size` (`2xs`…`xl`), while inherited or direct public values remain authoritative; the same pattern
`lr-select`'s `--lr-select-trigger-padding`/`--lr-select-font-size` use.
`--lr-input-control-height` pins an **exact** outer control-row height (both floors and caps it) —
for example to pixel-match an `<lr-select>` or `<lr-combobox>` in the same toolbar row. It is
undeclared by default, leaving `--lr-input-control-min-height` as a floor only and the row free to
grow. `--lr-input-gap` (default `--lr-space-xs`, the gap inside `[part='input-wrapper']`) is
retunable without a `::part(input-wrapper)` rule and, unlike the four properties above, does not
vary by `size` — the adornment gap a text field wants between an adornment and the caret is looser
than the icon-beside-label gap the ladder is tuned for. `--lr-input-radius` (default
`--lr-form-control-radius`, its corner radius) is retunable the same way but _does_ follow the tier:
the two tightest tiers take a smaller radius, since a 6px corner on a 20px-tall control reads as a
lozenge. `pill` changes its private default to `--lr-radius-pill`; an inherited or direct public
value still wins. `lr-number-input`/`lr-time-input` inherit both
unchanged.

`--lr-input-fill` (default `transparent`) is the control row's background and
`--lr-input-border-color` (default `var(--lr-color-border)`) its border color. `appearance` changes
their private fallback roles rather than the public hooks, and the documented defaults are
`appearance="outlined"`'s values. Ancestor theme wrappers therefore still win. Setting either
directly retunes the surface
without a `::part(input-wrapper)` rule and without leaving the `appearance` vocabulary behind.
`--lr-input-focus-border-color` independently retunes the focused row. Built-in clear/password
actions and `lr-number-input` steppers share `--lr-input-action-color`,
`--lr-input-action-hover-color`, `--lr-input-action-active-color`, and
`--lr-input-action-active-bg`; all fall back to the previous text/surface semantic tokens.
For `type="time"`, the browser-native picker indicator gains disabled-gated hover and focus-visible
affordances through `--lr-input-time-picker-hover-bg`, `--lr-input-time-picker-active-bg`,
`--lr-input-time-picker-focus-bg`, and `--lr-input-time-picker-focus-ring` (falling back to
brand-quiet/brand and the canonical focus-ring token).

### Shared form vocabulary — `size`, `appearance`, `pill`, and custom validity

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
  with `--lr-theme-form-control-height-*` rather than per component. Set
  `--lr-theme-form-control-radius` on the same ancestor to give these controls one shared corner
  radius across every tier; without it, the compact `2xs`/`xs` tiers retain their smaller default
  radius.
- **`appearance` is the fill vocabulary and nothing else.** `accent` (the loud semantic fill),
  `filled` (a quiet tint of the same tone), `outlined` (a border, no fill), `filled-outlined`
  (both) and `plain` (neither). It used to double as a _container_ treatment on other components;
  that meaning moved to `frame` (`card`/`plain`) in 8.0.0, so `appearance` means one thing
  library-wide. `lr-button` adds two tiers of its own on top (`quiet` and `link`). Text fields
  (`lr-input`, `lr-textarea`, and `lr-select`) default to `outlined`; `lr-button` defaults to `accent`.
- **`pill` rounds the control's ends.** Available on `lr-input`, `lr-number-input`, `lr-time-input`,
  `lr-textarea`, `lr-select`, `lr-combobox`, `lr-date-input`, `lr-phone-input`, `lr-token-input`,
  `lr-button` and `lr-radio-button`. In every case it does exactly one thing — re-assign that
  component's own `--lr-*-radius` knob to `--lr-radius-pill` — rather than declaring a radius on a
  part, so the knob stays the single corner-radius override point and a consumer's own value still
  wins over it.
- **`setCustomValidity(message)` and `resetValidity()` are on every form-associated _value_ control
  here** — every one
  that submits something, whether it drives `ElementInternals` through the shared mixin or by hand.
  (`lr-button` and `lr-icon-button` are form-associated so an ancestor `<fieldset disabled>` and
  `form.elements` reach them, but they carry no value or validity, so they have no such method.) It
  is the standard channel for a rejection no client-side constraint can express — a server-side
  "that email is already registered". A non-empty message raises `customError` and becomes
  `validationMessage`, so the control fails `checkValidity()`, blocks submission, and matches
  `:invalid`/`:state(invalid)`.
  `''` clears it and republishes the control's _own_ computed validity rather than forcing it valid:
  a required-and-empty field goes back to `valueMissing`. The message survives every intrinsic
  recomputation and a `form.reset()`, exactly like a native control; `setCustomValidity('')` or
  `resetValidity()` clears it. `resetValidity()` affects only that consumer layer and recomputes the
  current intrinsic constraints: it does not change `value`/`defaultValue`, make the control
  pristine again, or force an intrinsically invalid value valid. The message is used verbatim,
  never localized, because it is caller-supplied content.

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
in the calendar grid. The controls that _do_ wire it are `lr-input` (and its `lr-number-input`/
`lr-time-input` subclasses), `lr-combobox`, `lr-date-input`, `lr-phone-input`, `lr-token-input` and
`lr-otp-input`.

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
  _declared_ value, and a declared value wins over the `var()` fallback arm — so `auto` silently
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
<lr-input
  type="number"
  min="0"
  max="10"
  step="0.5"
  without-spin-buttons
  label="Weight"
></lr-input>
<lr-input type="search" clearable value="workflow" aria-label="Search"
  ><span slot="start">⌕</span></lr-input
>
<lr-input type="time" label="Reminder" id="reminder"></lr-input>
<button type="button" id="open-picker">Pick a time</button>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/input/input.js";
  const time = document.getElementById("reminder");
  // showPicker() needs user activation, so drive it from a real click.
  document
    .getElementById("open-picker")
    .addEventListener("click", () => time.showPicker());
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
  only for a value the _user_ edited, so the component recomputes both from its own `value` and ORs
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
own increment/decrement stepper pair. Its constructor and `connectedCallback()` both force
`type = 'number'`; all inherited `lr-input` form and editing APIs remain available.

**Inherits:** all public surface from `lr-input`.

The inherited `--lr-input-*` theme inputs keep `lr-input`'s ancestor-theme precedence; the number
subclass does not redeclare them on its host.
It also installs the shared six-tier size sheet: stepper-bearing rows follow the same rendered
action-height ladder as `lr-input` instead of remaining at the default tier for every `size`.

**Properties:** `size` (`2xs`…`xl`), `appearance`, `pill`, `autofocus`, `placeholder`, `readonly`,
`label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), `autocomplete`, `spellcheck`, `autocapitalize`,
`autoCorrect` (`autocorrect`), `inputMode` (`inputmode`), `enterKeyHint` (`enterkeyhint`), and
`min`/`max`/`step` (the native numeric constraint validation), all inherited from `lr-input` with
identical meaning. This component changes the mapped defaults to `appearance='outlined'`,
`inputMode='numeric'`, and `step=1`. `clearable` (and its `with-clear` spelling),
`passwordVisible` (`password-visible`), and `minlength`/`maxlength`/`pattern` are inherited but
inert — see gotchas.

Stepper switches:

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
- `withoutSteppers: boolean = false` (attribute `without-steppers`, not reflected) — the positive
  upstream spelling for hiding the custom pair. It does not invert `steppers`: either
  `without-steppers` or `steppers="false"` hides the same controls, and both unset leaves them on.

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
input), and `lr-clear`
(inherited, never fired here). The inherited `lr-invalid` (no detail) fires when a validity check
finds the input invalid. The internal native `beforeinput` is cancelable, bubbles, and composes;
calling `preventDefault()` on the host vetoes the edit before `value` changes.

**Slots:** `label`, `hint`, `error`, `start`, `end`, `decrement-icon`, and `increment-icon`.

**CSS parts:** `form-control`, `form-control-label`, `base` (compatibility name for the
control row; use `number-input`), `number-input` (the numeric control row; it is the same node as
`base` and the inherited `input-wrapper` part), `input-wrapper`, `input`, shared `stepper`, mapped
`stepper-decrement` / `stepper-increment`, and compatibility `stepper-down` / `stepper-up` (the two
stepper buttons, rendered only while both switches permit them; they sit side by side
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
The inherited `--lr-input-focus-border-color` and four `--lr-input-action-*` hooks also apply to
the numeric row and its steppers, so their state paint can be isolated from other form controls.
The exact-320px RTL story keeps long label/hint copy and both fixed-size steppers within the host.

```html
<lr-number-input
  label="Quantity"
  min="0"
  max="99"
  step="1"
  value="1"
></lr-number-input>
<!-- A bare numeric field: no steppers, and the browser's own spinners back: -->
<lr-number-input
  label="Quantity"
  steppers="false"
  without-spin-buttons="false"
></lr-number-input>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/input/number-input.js";
</script>
```

**Known gotchas:**

- **`steppers` and `without-spin-buttons` both default to `true` here.** Only the literal string
  `"false"` parses as `false`; every other attribute value — including an empty one, and including
  _removing_ the attribute — parses as `true`. So `?attr=${false}` and a removed attribute cannot
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

A locale-aware segmented field and column picker mirroring `wa-time-input`. Its wire and submitted
value is always timezone-free, 24-hour ASCII: `HH:mm`, or `HH:mm:ss` when seconds are visible.
Locale changes segment order, separators, digits, and day-period labels — never the wire value.
Typing accepts both ASCII digits and the active locale's digit glyphs, and validation-message
bounds use the same localized time presentation rather than exposing the ASCII wire form.
An incomplete draft remains visible for editing but submits `''` and raises `badInput`.
The clear/expand actions sit directly in the shared outer height ladder: compact tiers grow only
enough for their hit targets, while `l` and `xl` retain the shared 48px and 56px heights rather
than adding outer padding around the buttons.

**Properties:**

- `value: string` (also accepts a `Date` or `null` when assigned) — strict `HH:mm`, optional
  `:ss`/`.sss`; `Date` reads local clock fields without timezone conversion. Invalid strings and
  `null` normalize to `''`. `valueAsNumber` is milliseconds since midnight (`NaN` while blank),
  and `valueAsDate` applies the clock fields to today's local date (`null` while blank). Both are
  settable, like the native `<input type="time">` properties they mirror: assigning `valueAsNumber`
  sets `value` from the same scale, and out-of-range or non-finite figures clear the field rather
  than wrapping into a different time; assigning `valueAsDate` reads the same local clock fields
  back off the Date, so it round-trips with the getter, and `null`/an invalid Date clears. Both
  assignments are silent, again like the native properties.
- `defaultValue`, `name`, `form`, `disabled`, `required`, `customError`, `getForm()`,
  `checkValidity()`, `reportValidity()`, `setCustomValidity()`, and `resetValidity()` use the shared form-control
  contract. Reset restores the current declarative `value` default; `readonly` remains focusable
  and submits but cannot be edited. `resetValidity()` clears only consumer custom validity and
  restores the current intrinsic time constraints; it leaves the value/default and interaction
  state unchanged.
- `min = ''`, `max = ''` accept the same canonical time syntax. `min <= max` is an ordinary
  closed range; `min > max` is an overnight range (for example `22:00` through `06:00`).
- `step: number | 'any' = 60` is seconds. A numeric value below 60 reveals seconds. Numeric
  validation follows native time step-base precedence: valid `min`, otherwise the current reset
  default (`defaultValue`/the `value` content attribute), otherwise midnight. Picker options are
  projected from the complete valid-time grid, so offset, hourly, multi-hour, bounded and overnight
  grids expose only reachable values and retain a selected valid value. `'any'` disables step
  mismatch and exposes the unrestricted segment vocabulary.
- `hourFormat: 'auto' | '12' | '24' = 'auto'` (`hour-format`) overrides the locale's hour cycle.
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'`,
  `size` (shared `2xs`…`xl` ladder and `small`/`medium`/`large` aliases), and `pill = false`.
- `label = ''`, `hint = ''`, `errorText = ''` (`error-text`), `withLabel = false`
  (`with-label`), and `withHint = false` (`with-hint`) provide complete form chrome. A host
  `aria-label` wins for the internal editing surface's accessible name.
- `open = false`, `placement = 'bottom-start'`, and `distance = 0` control the picker.
  `show()` / `hide()` return `Promise<void>` and settle after the matching `lr-after-*` event.
- `withClear = false` (`with-clear`) adds a localized clear action. `withNow = false`
  (`with-now`) adds a localized Now footer unless the `footer` slot replaces it.
- `autocomplete = ''` is forwarded to a visually hidden, nameless native time input used only as
  the browser autofill seam; the FACE host remains the sole submitted control.

**Methods:** `focus(options?)`, `blur()`, and `click()` delegate to the active segment; `focus()` and
`click()` are synchronous no-ops while directly or fieldset disabled, so they cannot create focus
events from a removed tab stop. If a controlled locale, `hourFormat`, or `step` change removes the
segment that currently owns focus, the first surviving segment receives focus after the new pattern
renders. A format change never reclaims focus from another control. `show()` and `hide()` control the
picker, while its form methods are described above. Disconnecting force-closes without a veto and
reconnects with `open`, its attribute, ARIA, popup visibility, and `:state(open)` all closed. A
visible incomplete draft retains its segments, digit buffer, empty submitted value, and `badInput`
state across detach/adoption/reconnect.

**Keyboard:** only one segment is in the tab order. Digits fill the active segment and advance when
no further digit can be accepted; Left/Right moves in locale order and reverses under RTL;
Up/Down steps, Home/End selects the segment edge, and Backspace/Delete clears the segment.
Pasting a canonical time replaces the full value as one edit. Alt+ArrowDown opens the picker.
Inside a picker column, one enabled option is tabbable; ArrowUp/ArrowDown rove, Home/End jump to
the bounds, and Enter/Space activate the focused native option button. Disabled controls project
`disabled` and `tabindex=-1` to every picker option.
`readonly` keeps navigation and popup browsing but blocks commits; `disabled` removes the tab stop,
popup, validation, and form submission.

**Events:** native `input` on user edits and native `change` on a complete commit; compatibility
aliases `lr-input` / `lr-change` carry `{ value }`. `focus` / `blur` cross the shadow boundary once.
`lr-clear` follows a clear. Cancelable `lr-show` / `lr-hide`
precede popup state changes; `lr-after-show` / `lr-after-hide` follow motion settlement.
`lr-invalid` follows a failed validity check.
The hidden native autofill seam treats an intentional empty `input` followed by `change` as a
single clear transaction, emitting `input`, `lr-input`, `change`, then `lr-change` exactly once.

**Slots:** `label`, `hint`, `error`, `start`, `end`, `clear-icon`, `expand-icon`, and `footer`.

**CSS parts:** `form-control`, `form-control-input`, `form-control-label label` (same node),
`base time-input input-wrapper` (same node), `input`, `segment`, `segment-literal`, `start`, `end`,
`clear-button`, `expand-button`, `expand-icon`, `popup`, `columns`, `column`, `column-item`,
`column-item-selected`, `now-button`, `hint`, and `error`.
Each `column` is a block-axis scroll container and explicitly clips inline overflow, so an
undersized `--column-width` cannot introduce a second scrollbar.
The label/hint/error chrome wraps unbroken localized content within the host, while `start`/`end`
adornments shrink and ellipsize. The exact-320px RTL story keeps that copy, the seconds segments,
fixed-size actions, and the open picker contained.

`error` is ordinary visible validation text referenced by the segmented input through
`aria-describedby`, not a shadow `role="alert"`. Native `reportValidity()`/focus feedback therefore
has one description path instead of being duplicated by a second live-region announcement.
The group and every spinbutton expose explicit stateful `aria-invalid`: visible property/slotted
error chrome makes it `"true"` immediately, as does intrinsic/custom invalidity after interaction;
otherwise each owner explicitly exposes `"false"`.
Every spinbutton renders explicit `aria-required="true"` or `"false"`. While required, the
segmented `role="group"` also acquires a localized visually-hidden requiredness description without
overwriting its existing hint/error relationship; removing `required` releases only that text.

**Custom states:** `blank`, `disabled`, and `open`, plus the shared validity states.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
the `form-control-label` node — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. With no label text the part is hidden and no glyph is
painted.

**Themeable custom properties:** `--lr-time-input-gap` (outer segment/adornment/action gap,
default `--lr-form-control-gap`) and `--lr-time-input-radius` (outer row radius, default
`--lr-form-control-radius`, or `--lr-radius-pill` with `pill`) remain undeclared on the host, so an
ancestor theme wrapper or direct-host value overrides those fallbacks. Also available are
`--lr-time-input-border-color`, `--lr-time-input-fill`, and `--lr-time-input-color` for the
appearance surface; `--lr-time-input-focus-border-color`;
`--lr-time-input-segment-hover-bg`, `--lr-time-input-segment-active-bg`, and
`--lr-time-input-segment-focus-bg`; `--lr-time-input-action-color`,
`--lr-time-input-action-hover-color`, `--lr-time-input-action-hover-bg`, and
`--lr-time-input-action-active-bg`; and `--lr-time-input-column-hover-bg`,
`--lr-time-input-column-active-bg`, `--lr-time-input-column-selected-bg`,
`--lr-time-input-column-selected-color`, `--lr-time-input-column-selected-font-weight`,
`--lr-time-input-column-selected-hover-bg`, and `--lr-time-input-column-selected-active-bg`.
Every state hook falls back to the exact semantic token or color mix used previously, and remains
undeclared on the host so ancestor themes work. The upstream-compatible
`--column-item-height`, `--column-width`, `--show-duration`, and
`--hide-duration`, each with a Lyra design-token fallback.

```html
<lr-time-input
  label="Start time"
  value="09:30"
  with-clear
  with-now
></lr-time-input>
<lr-time-input label="Precise time" step="15" value="09:30:15"></lr-time-input>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/input/time-input.js";
</script>
```

## `lr-native-time-input`

The Lyra 7 browser-native time field preserved under an explicit tag. It extends `lr-input`,
forces its internal native input to `type="time"` on construction and reconnect, and retypes
`min`/`max` so time-shaped attributes such as `09:00:30` are forwarded verbatim instead of parsed
as numbers. Use it when the browser/OS picker is preferred; new `wa-time-input` migrations should
use the segmented `lr-time-input` above.

**Inherits:** all public surface from `lr-input`.

All `lr-input` properties, form methods, events, label/hint/error/start/end slots, parts, and theme
properties apply. `step` is native seconds; `showPicker()`, `stepUp()`, and `stepDown()` keep their
native-wrapper behavior. The control row carries `base input-wrapper time-input` part tokens on one
node. Its native picker UI and AM/PM presentation are browser-owned and intentionally unstyled.
The inherited `--lr-input-*` theme inputs therefore remain configurable from an ancestor theme
wrapper without being shadowed by the subclass.

**Events:** native-style `input` and `change`; bubbling, composed `focus` and `blur` bridges; the
`lr-input` / `lr-change` aliases with `{ value }`;
`lr-clear` after the inherited clear action; and `lr-invalid` when a validity check fails.

**CSS parts:** all inherited `lr-input` parts, plus `time-input` on the same control-row node as
`base` and `input-wrapper`.

```html
<lr-native-time-input
  label="Start time"
  min="09:00"
  max="17:00"
  value="09:30"
></lr-native-time-input>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/input/native-time-input.js";
</script>
```

---

## `lr-phone-input`

A form-associated, country-aware telephone field. The submitted `value` is either canonical E.164
(for example `+352621123456`) or `''` while the editable input is empty, incomplete, or invalid.
Numbering-plan metadata and national formatting stay outside Lyra's base bundle: supply a
synchronous `LyraPhoneNumberAdapter`, or lazily create one from a `libphonenumber-js`-compatible module
with `loadLibphonenumberAdapter()`. Without an adapter, already-international E.164 input still
normalizes and validates; national input remains editable with `incomplete` validity. The loader
returns its discovered country catalog as a frozen array of frozen records.

The country selector keeps the real native `<select>` (localized full country names in its popup,
native mobile pickers, keyboard type-ahead) but stretches it invisibly over a compact decorative
trigger showing the selected alpha-2 code plus a design-system chevron — long country names never
clip the closed control and the adjacent calling code isn't repeated. With `flags`, the trigger
also shows the selected country's `<lr-flag>`.

Public `--lr-phone-input-*` theme inputs stay undeclared on the host, so an ancestor theme wrapper
can override size and pill fallbacks; a value set directly on the element still wins.
The native country-selector target retains the shared icon-button hit floor, and the wrapper uses
the same rendered action-height ladder as input, number-input, and segmented time-input.

**Types:**

```ts
type LyraPhoneNumberStatus = "empty" | "incomplete" | "invalid" | "valid";

interface LyraPhoneCountry {
  readonly code: string; // ISO 3166-1 alpha-2
  readonly callingCode: string; // no leading "+"
  readonly label?: string; // overrides Intl.DisplayNames
}

type LyraPhoneNumberParseResult =
  | {
      status: "empty" | "incomplete" | "invalid";
      formatted?: string; // best-effort editable display text
      country?: string; // detected ISO alpha-2 code
    }
  | {
      status: "valid";
      e164: string; // required and E.164-shaped on the only successful branch
      formatted?: string;
      country?: string;
    };

interface LyraPhoneNumberAdapter {
  readonly countries?: readonly LyraPhoneCountry[];
  parse(input: string, country?: string): LyraPhoneNumberParseResult;
}
```

**Properties:**

- `value: string = ''` — canonical E.164 form/submission value. A programmatic assignment is parsed
  and normalized synchronously but emits no user event.
- `name: string = ''`, `disabled: boolean = false`, `required: boolean = false` — native-like
  form-control properties supplied by `FormAssociated`; inherited disabled fieldsets are included
  through `effectiveDisabled`.
- `defaultValue: string = ''` (attribute `value`) is the reset target, and `customError: string |
null` (attribute `custom-error`) carries a consumer-supplied validation message.
- `adapter?: LyraPhoneNumberAdapter` (attribute: false) — synchronous numbering-plan
  parser/formatter. No metadata implementation is imported by the component itself. Runtime
  results are validated exhaustively: unknown statuses, hostile getters, wrong optional-field
  types, and a `valid` result without E.164 all fail closed to `invalid`.
- `countries?: readonly LyraPhoneCountry[]` (attribute: false) — `undefined` discovers
  `adapter.countries`; every supplied array, including `[]`, is authoritative. Rows are copied and
  validated at the boundary; a row without a two-letter code or 1–3 digit calling code, a duplicate,
  or a throwing getter is skipped without hiding later valid rows. Explicit and adapter-provided
  catalogs are bounded to 512 rows and captured as frozen owned snapshots when assigned.
- `defaultCountry: string = ''` (attribute `default-country`) — selected when `country` has not been
  set explicitly.
- `flags: boolean = false` (reflected) — show the selected country's flag in the country trigger as
  `<lr-flag variant="compact" aria-label="">` (decorative; the native select already announces the
  country name). The `<lr-flag>` element definition is registered lazily the first time any
  `lr-phone-input` enables this, so nothing flag-related is bundled while it stays off. Flag
  _artwork_ still follows the standalone `<lr-flag>` contract: install the optional
  `@aceshooting/lyra-flags` peer and import
  `@aceshooting/lyra-ui/components/media/flag/flag-peer.js` once; without that registration the
  trigger simply omits the image. The open popup list stays text-only — a native `<option>` cannot
  contain elements.
- `size: LyraSize = 'm'` (reflected — the shared control ladder, so both `2xs`/`xs`/`s`/`m`/`l`/`xl`
  and `small`/`medium`/`large` are accepted; scales input padding, font size, and wrapper
  min-height; `size="s"` shares its outer control height with `lr-input`, `lr-select`, and
  `lr-combobox` without part overrides)
- `pill: boolean = false` (reflected) — rounds the field's corners to a full pill, mirroring
  `lr-input`'s own `pill`. It changes the private radius default to `--lr-radius-pill`, and the
  country trigger's leading corners follow; an inherited or direct `--lr-phone-input-radius`
  remains authoritative
- `country: string` — current uppercase ISO alpha-2 selection; falls back to `defaultCountry`, then
  the first explicit/adapter country. A requested or adapter-detected country absent from the
  effective catalog resolves to that same valid fallback before property, trigger, native select,
  calling-code, and parser projection. An empty effective catalog resolves to `''`. Changing the
  country reparses the editable number.
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
  `placeholder`, and finally a localized generic "Phone" name, so a bare `<lr-phone-input>` with
  none of them set never reaches the accessibility tree unnamed. (The visible label part cannot
  stand in for it: it carries the native `hidden` attribute while there is no label text, which
  removes it from the accessibility tree entirely.)
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
- `readonly: boolean = false` (reflected) — forwards to the native telephone input, locks the
  country selector and all user edit handlers, and bars validation while retaining focus,
  selection/copying, canonical form value, and submission.
- `autofocus: boolean = false` (reflected) — forwarded to the actual native telephone input; it is
  never stranded on the non-focusable host.
- readonly `input: HTMLInputElement | undefined` — the internal native telephone input.
- readonly `inputValue: string` — editable formatted/partial text, which remains available even when
  canonical `value` is `''`.
- `selectionStart`, `selectionEnd`, and `selectionDirection` — native selection getters/setters
  forwarded to the telephone input
- readonly `phoneStatus: LyraPhoneNumberStatus` — current parse state. The host also reflects it through
  `data-phone-status`.
- readonly `form`, `labels`, `validity`, `validationMessage`, `willValidate`, and
  `effectiveDisabled` — the shared form-associated native-like getters.

**Events:** each text edit emits native `InputEvent` `input` then `lr-input`; telephone-input commit
emits native `Event` `change` then `lr-change`; and a country pick emits both pairs in order:
`input`, `lr-input`, `change`, `lr-change`. Native events carry no custom detail; the aliases carry
`{ value, inputValue, country, valid, status }`.
Internal `focus`/`blur` are relayed once as realm-correct native `FocusEvent`s preserving `relatedTarget`.
`lr-invalid` has no detail and is the one bubbling/composed alias
when native validity fails. Programmatic value writes remain silent.

**Validity:** empty + `required` sets `valueMissing`; incomplete dial-like input sets `badInput`;
completed-invalid input sets `typeMismatch`; valid E.164 input clears all three. Partial or invalid
text remains in `inputValue`/the native input so validation never makes a number impossible to edit,
but its canonical submitted `value` is blank. Native validation feedback is anchored to the
telephone input, not the adjacent country selector.

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange()`, and `setRangeText()`
forward to the native telephone input. Range-text edits reparse the number and synchronize the
canonical value, form value, and validity.
`getForm()`, `setFormValue(value)`, `checkValidity()`, and `reportValidity()` come from
`FormAssociated`. `setCustomValidity(message)` sets or clears `customError` without discarding the
control's intrinsic phone-number validity. `resetValidity()` clears only that consumer error and
recomputes the current phone-number constraints; it does not change the editable/canonical value,
the reset default, or prior interaction state.
`form.reset()` restores the original declarative `value` and the default country.

**Slots:** `label`, `hint`, `error`, `country-prefix` (optional visual before the country selector,
such as a consumer-owned `<lr-flag>`; no flag package is imported automatically).

**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `country-prefix`, `country`
(the selector region: invisible native select layered over the visual trigger), `country-select`,
`country-trigger` (visible, `aria-hidden` closed-state box), `flag` (the `<lr-flag>`, only with
`flags`), `country-code` (selected alpha-2 code, `data-placeholder` when no country exists),
`expand-icon`, `calling-code`, `input`, `hint`, `error`.

`error` is ordinary visible validation text referenced by the native telephone input through
`aria-describedby`, not a shadow `role="alert"`. Native invalid/focus feedback therefore has one
description path instead of being duplicated by a second live-region announcement.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the part is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-phone-input-padding-block` (scaled through the shared
form-control padding ladder), `--lr-phone-input-font-size`, and
`--lr-phone-input-control-min-height` (each scaled by `size`), plus `--lr-phone-input-control-height`
to pin an exact input-wrapper height (both floors and caps it — use it for pixel-matching an
`<lr-input>` or `<lr-select>` in the same toolbar row; undeclared by default, leaving the min height
as a floor only). The phone-number input and calling code are deliberately `dir="ltr"`/isolated
because telephone numbers are algorithmic content; surrounding form chrome and the country selector
inherit LTR/RTL and use logical spacing/borders.
The native country selector's hover and press backgrounds are supplemented in forced-colors mode
with dashed/solid `Highlight` outlines, so those states do not collapse when the UA flattens the
background tint to `Canvas`.

**Optional peer deps:** `libphonenumber-js` is declared optional but never imported by Lyra itself.
For full national parsing/formatting, install it in the consuming app and pass it through the
consumer-supplied lazy loader below. Because the import expression lives in consumer code, no
numbering metadata enters a bundle that does not opt in.

```ts
import "@aceshooting/lyra-ui/components/forms/phone-input/phone-input.js";
import { loadLibphonenumberAdapter } from "@aceshooting/lyra-ui/components/forms/phone-input/phone-input.class.js";

const phone = document.querySelector("lr-phone-input");
phone.adapter = await loadLibphonenumberAdapter(
  () => import("libphonenumber-js/min")
);
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
import "@aceshooting/lyra-ui/components/media/flag/flag-peer.js";
```

```html
<lr-phone-input
  label="Mobile number"
  flags
  default-country="LU"
></lr-phone-input>
```

**Known gotchas:**

- An adapter's `parse()` method is synchronous because it runs on every keystroke. Load any optional
  module first, then assign the resolved adapter. Once an adapter is assigned, exceptions and
  malformed results fail closed to `invalid`; only the no-adapter mode uses the E.164-only fallback.
- A valid adapter result must include an E.164-shaped `e164`; the discriminated result type makes
  that requirement statically visible and runtime normalization prevents malformed success from
  entering form submission.
- Country names use `Intl.DisplayNames` and fall back to the ISO code; set `LyraPhoneCountry.label` for
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
The `base` part is an accessible `role="group"`: a non-empty host `aria-label` names the two-handle
aggregate. A native external `<label for>` remains available through `labels`, but it does not cross
into the shadow-root group. `startLabel` and `endLabel` continue to name the individual sliders.

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
- `startLabel?: string` (attribute `start-label`) — caller-owned `aria-label` override for the start
  handle; absence resolves localized `rangeStart` (`"Range start"` in English), while every
  supplied string — including `"Range start"` and `""` — remains literal
- `endLabel?: string` (attribute `end-label`) — equivalent override for the end handle; absence
  resolves localized `rangeEnd` (`"Range end"` in English)
- `valueFormatter?: TimeRangeValueFormatter` (attribute: false) — maps each finite, clamped
  `aria-valuenow` to optional human-readable `aria-valuetext`; called as
  `(value, handle: TimeRangeHandle)`, where `TimeRangeHandle = 'start' | 'end'`. The formatter may
  return `string | null | undefined`; a nullish result omits `aria-valuetext` for that handle.
  Leaving the property unset preserves the numeric-only contract
- `presets: readonly TimeRangePreset[] = []` (attribute: false) — readonly `TimeRangePreset {
label: string; start: number; end: number }`; a bounded frozen snapshot of optional discrete
  presets (e.g. "Last 7 days") rendered as a
  `[part="presets"]` button row above the track — purely additive, the continuous brush is
  unaffected and both interaction modes coexist; picking one sets both handles and emits the same
  native/prefixed input and change sequences a committed drag or keyboard step would. Preset
  endpoints are clamped and ordered once, and that same normalized pair drives both application
  and `aria-pressed`/`data-active` projection
- `customError: string | null` (attribute `custom-error`, reflected) — consumer validation message

**Events:** a native-style composed `input` (no detail) then `lr-input` (`detail: { start, end }`),
both fired continuously while dragging or on each arrow/Home/End/PageUp/PageDown key press; and a
native-style composed `change` (no detail) then `lr-change` (`detail: { start, end }`), both fired
on pointer release, keyboard keyup, handle blur while a changed keyboard gesture is still pending,
or when a preset button is clicked. A blur commit retires the gesture before the later physical
keyup, so it cannot emit a duplicate change. The focused handle's native `focus` and `blur` are
re-dispatched from the host as bubbling, composed events. A failed native validity check emits one bubbling/composed,
cancelable `lr-invalid` alias; cancelling it cancels the native `invalid` event and suppresses the
browser's default validation UI.

**Methods:** `focus(options?)` and `click()` forward to `[part="handle-start"]`. `blur()` releases
whichever handle actually owns focus, falling back to the start handle when neither does. Without
these overrides the host's own `focus()`/`blur()`/`click()` are no-ops, because the real controls
live in the shadow root. `getForm()` returns the browser-resolved owning form.

`setCustomValidity(message)` is this control's **only** validation channel: every reachable range is
intrinsically legal, so there is no constraint for it to compute. A non-empty message raises
`customError`, becomes `validationMessage`, and blocks submission of the form it sits in; `''`
clears it. The error survives handle moves, preset picks and a form reset, exactly like a native
control — so a consumer re-validating a range on every `lr-input` calls this with the new message
(or `''`) each time rather than expecting the movement itself to clear it. The message is
caller-supplied and is used verbatim, never localized.

Programmatic writes to `start` and `end` are event-silent. When a controlled caller writes both in
one update, the pair is clamped and ordered atomically (for example `90/10` becomes `10/90` without
losing either endpoint). A one-sided write retains moved-handle semantics: a start above the current
end is pulled back to that end, while an end below the current start is pulled up to that start.

**`form.reset()` — `formResetCallback()`.** The control has no submitted value, but it does take
part in its owning form's reset, and a reset undoes everything the _user_ did to it:

- **The range** goes back to the declared `start`/`end` **content attributes** — the markup default,
  the way a native `<input>` resets to its `value` attribute rather than to its current IDL value. A
  handle with no attribute falls back to the domain bound it started at. The restored pair is
  normalized the same way a preset pick is (clamped into `[min, max]`, then ordered so
  `start <= end`), so an inverted or out-of-range declared range still restores to a legal one.
- **The interaction flag** is cleared, which makes the control pristine again: `:state(user-valid)`
  and `:state(user-invalid)` stop matching until the user touches it again. Without this, a range a
  consumer had rejected kept rendering as the user's mistake on a form they had just reset.
- **An in-flight keyboard gesture** is dropped, so the next key-up cannot commit an `lr-change` for
  a step the reset already discarded. Every in-flight pointer drag is also retired synchronously,
  including its window listeners, so a later pointer release cannot commit the restored range as a
  stale user change. Direct and fieldset disablement use the same gesture invalidation path.

Two things deliberately **survive** the reset, matching native semantics:

- **A `setCustomValidity()` message**, and with it `customError`, `validationMessage`,
  `:state(invalid)` and blocked submission. Only another `setCustomValidity('')` clears it. The
  reset stops it looking like the user's error; it does not decide the consumer's constraint is
  satisfied. If a reset should also clear your rejection, call `setCustomValidity('')` from your own
  `reset` listener.
- **`disabled`, `min`/`max`, `step`, `presets`, and every other author-set property** — a reset
  restores the user's edits, not the component's configuration.

The reset **emits nothing**: like a native control, it is the form's edit rather than the user's, so
no `input`/`change`/`lr-input`/`lr-change` fires. Read `start`/`end` in a `reset` listener on the
form if you need to react. There is deliberately no `formStateRestoreCallback()` beside it — this
control never calls `setFormValue()`, so the browser has no serialized state to hand back for
autofill or back/forward restore.

**Slots:** none.

**CSS parts:** `base` (the aggregate `role="group"`), `track`, `range`, `handle-start`, `handle-end`,
`presets`, `preset-button`

**Themeable custom properties:** mostly shared tokens — `--lr-color-border`, `--lr-color-brand`,
`--lr-color-surface`, `--lr-shadow-s` (handles), `--lr-opacity-disabled` (`:host(:disabled)`
dimming, including ancestor-fieldset disablement), plus (for `presets`) `--lr-color-text`,
`--lr-color-on-brand` (the active preset
button's text), `--lr-radius`, `--lr-space-xs/-s`, `--lr-transition-fast`,
`--lr-focus-ring-*`.

Three component-local properties recolor the **active** preset button independently of the shared
palette: `--lr-time-range-preset-active-bg` (falls back to `--lr-color-brand`),
`--lr-time-range-preset-active-border-color` (falls back to `--lr-color-brand`), and
`--lr-time-range-preset-active-color` (falls back to `--lr-color-on-brand`). Unset, each resolves
to exactly the token the rule used before they existed, so the default rendering is unchanged.

Pointer states and handle chrome are independently themeable too:

- `--lr-time-range-preset-hover-border-color`,
  `--lr-time-range-preset-pressed-border-color`, and `--lr-time-range-preset-pressed-bg` control
  preset hover/press paint.
- `--lr-time-range-handle-bg`, `--lr-time-range-handle-border-color`,
  `--lr-time-range-handle-hover-bg`, and `--lr-time-range-handle-pressed-bg` control the handle's
  resting, hovered, and pressed paint.

Every hook falls through to the prior shared brand/surface token or color-mix expression, so old
themes retain their rendering and can opt into only the state they need.

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
  const months = ["April 2023", "May 2023", "June 2023"];
  const range = document.getElementById("months");
  range.valueFormatter = (value, handle) =>
    `${handle === "start" ? "From" : "Through"} ${months[value]}`;
  range.addEventListener("lr-change", (e) =>
    console.log(e.detail.start, e.detail.end)
  );
</script>
```

**Known gotchas:**

- Keyboard support now matches the full WAI-ARIA APG slider pattern: ArrowUp/Right and ArrowDown/Left
  move by `step` (RTL-aware — under `direction: rtl` the forward/backward keys swap so they still
  track the visually-adjacent direction), PageUp/PageDown move by `step * 10`, and Home/End jump to
  that handle's actual _reachable_ bound — clamped by the sibling handle's current value, not the
  component's full `[min, max]` domain, so Home/End on the `end` handle can't jump past `start` (and
  vice versa). Pointer-drag is RTL-aware the same way (mirrors the drag ratio under `direction:
rtl`).
- **Click-to-seek on the track.** A pointerdown anywhere on `[part="base"]` other than a handle
  itself jumps whichever handle is nearer the clicked position to that point and continues as the
  same drag gesture, then focuses that handle so arrow keys carry on from there. It emits `lr-input`
  on the jump and a single `lr-change` on release, mirrors the ratio under RTL exactly as dragging
  does, breaks a tie toward the handle that can actually travel toward the click, and does nothing
  while the control is disabled. This matches `lr-slider[range]`'s identical behavior; a pointerdown
  that starts on a handle is still a plain handle drag.
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
  fix as `lr-multi-split`.
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
accent-color buttons. Its `items` are the _only_ choices; a `lr-color-picker`'s `swatches` are a
shortcut list alongside a grid, a hue ramp and a text field that can still express any colour.
Arrow/Home/End navigation starts from the swatch that actually received the keyboard event, even
when a controlled `value` write changed the selected or remembered roving item first.

**Properties:**

- `items: readonly SwatchPickerItem[] = []` (attribute: false) — `SwatchPickerItem { readonly value:
string; readonly color: string; readonly label: string; readonly icon?: unknown; readonly
gemstone?: GemstoneKey }`; a valid CSS `color` is used as the
  swatch fill, while invalid values, declaration-breaking input, and `url()` are ignored (and are
  never interpolated into a gemstone SVG). `label` is each swatch's accessible name and `title`.
  `icon` is an optional custom shape rendered _instead of_ the plain filled circle. Its rendered
  subtree stays visible but is inert and hidden from assistive technology, so the swatch button
  remains the sole action. `gemstone` selects the canonical faceted glyph when
  `mode="gemstone"`. An explicit `icon` wins over `gemstone`. Assignments are bounded and copied
  into a frozen owned snapshot; mutate a new array/item and reassign it to update the palette.
- `value: string | null = null` — the currently selected option's `value` (controlled); `null`
  leaves nothing selected while keeping the first swatch tabbable.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected — scales the swatch hit-area and
  fill diameter proportionally, hit-area floored at 24px; not pixel-matched to `lr-input`'s
  row-height scale)
- `mode: 'swatch' | 'gemstone' = 'swatch'` (reflected) — `swatch` preserves the plain-circle
  default. `gemstone` renders the shared glyph for options carrying a `gemstone` key and enables
  the selected glow/shine defaults.
- `accessibleLabel: string = ''` (attribute `aria-label`) — accessible name copied to the internal
  `role="radiogroup"`; attribute presence wins, including an explicitly empty name.
- The 9.x compatibility aliases were removed in 10.0.0: `options` is `items`, the exported
  `SwatchOption` type is `SwatchPickerItem`, and the former invisible `label` IDL is
  `accessibleLabel`/`aria-label`. The canonical sibling radiogroup vocabulary is now the only
  spelling.
- `disabled: boolean = false` (reflected) — locks the whole picker. Every swatch renders as a real
  `disabled` `<button>`, so it leaves the tab sequence and cannot be activated; arrow/Home/End
  navigation and host `click()` become no-ops; and the swatches dim to `--lr-opacity-disabled` with
  a `not-allowed` cursor and no hover lift. This is the picker's own attribute only: the control is
  deliberately **not** form-associated (it submits nothing and carries no `name`, validity or reset
  semantics), so an ancestor `<fieldset disabled>` does not cascade into it — disable the picker
  itself alongside the fieldset when a form needs both.

**Events:** `lr-change` (`detail: { value }`) — fired only when the selected value actually
changes via click or keyboard (re-selecting the current swatch is a no-op).

**Slots:** none.

**CSS parts:** `base` (the `role="radiogroup"` root), `swatch` (a single `role="radio"` color
swatch's interactive hit target, sized via `--lr-swatch-picker-hit-size` — its private default
follows `size` and is floored at 24px; the selected one is
`[part='swatch'][aria-checked='true']`), `swatch-fill` (the filled circle inside it, sized via
`--lr-swatch-picker-fill-size` — defaults to `--lr-size-1-5rem`, with a private default that also
follows `size` —
rendered when the option has no `icon`), `swatch-icon` (the option's `icon` shape, rendered in its
place when it has one, with its inherited `font-size` set to the same fill-size token so a `1em`
glyph fills the wrapper; the wrapper is inert and aria-hidden across the flattened subtree).
Exactly one of `swatch-fill`/`swatch-icon` is mounted per swatch, so the two never coexist.

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
size; its private default follows `size`), `--lr-swatch-picker-fill-size` (visible fill/icon
diameter; its private default follows `size`; set this hook on an ancestor/direct host to override
every tier, or `--lr-theme-swatch-picker-fill-size` on an ancestor for a shared default),
`--lr-swatch-picker-gemstone-selected-blur` (default `--lr-size-0-5rem` in
gemstone mode), `--lr-swatch-picker-gemstone-shine-duration` (default `1.8s` in gemstone mode);
plus shared tokens — `--lr-color-border`/`-brand`, `--lr-space-xs`,
`--lr-border-width-thin`/`-thick`, `--lr-radius`, `--lr-transition-fast`, `--lr-focus-ring-*`,
and the per-tier `--lr-size-*` tokens.

**Optional peer deps:** none.

```html
<lr-swatch-picker aria-label="Accent color"></lr-swatch-picker>
<script type="module">
  const picker = document.querySelector("lr-swatch-picker");
  picker.items = [
    { value: "blue", color: "#0969da", label: "Blue" },
    { value: "green", color: "#1a7f37", label: "Green" },
    { value: "purple", color: "#8250df", label: "Purple" },
  ];
  picker.value = "green";
  picker.addEventListener("lr-change", (e) => console.log(e.detail.value));
</script>
```

For the shared gemstone accent mode, import the Lit-free palette data entry. The glyph renderer
remains available separately from `theme/gemstones.js` for Lit templates; palette-only consumers
do not need to load Lit. The consumer still owns localized labels, display order, and the initial
value:

```ts
import "@aceshooting/lyra-ui/components/forms/swatch-picker/swatch-picker.js";
import { GEMSTONES } from "@aceshooting/lyra-ui/theme/gemstones-data.js";

const order = ["emerald", "ruby", "sapphire", "hematite"] as const;
picker.mode = "gemstone";
picker.items = order.map((key) => ({
  value: key,
  color: GEMSTONES[key].fill,
  label: translateGemstone(key),
  gemstone: key,
}));
picker.value = "ruby";
```

**Known gotchas:**

- arrow-key navigation cycles (past the last swatch wraps to the first, and vice versa) rather than
  clamping, and self-selects on move — arrow-navigating to a swatch immediately updates `value` and
  fires `lr-change`, there's no separate commit step.
- live `items` changes preserve a focused swatch by item-object identity across reorders.
  Removing the focused option moves focus and the roving tab stop to the nearest surviving swatch
  (the next item at that position, or the previous item when the final option was removed) without
  changing the controlled `value` or emitting `lr-change`.
- under RTL (nearest `dir="rtl"` ancestor) `ArrowLeft`/`ArrowRight` swap which direction they move.
- each swatch's fill comes from its option's `color`, applied through a per-swatch custom property
  set inline on `[part='swatch']` and read by `[part='swatch-fill']`, so a consumer's
  `::part(swatch-fill)` `background-color` rule can still override it.
- style the selected state through `--lr-swatch-picker-selected-color`/`-selected-blur`/
  `-shine-duration`, not through `::part(swatch)[aria-checked='true']` from outside: the CSS Shadow
  Parts spec only allows a fixed set of pseudo-classes after `::part()`, not arbitrary attribute
  selectors, so that combinator can silently fail to match depending on the engine.
- the semantic `radiogroup` lives inside shadow DOM. Set `accessibleLabel` or a host `aria-label`;
  the component deliberately forwards the resulting name to that internal role.

**Additional API surface:**

- `--lr-swatch-picker-gap` — Gap between swatches. Default: `var(--lr-space-xs)`.

---

## `lr-checkbox`

A boolean form control. `role="checkbox"` with an `aria-checked` that can also be `"mixed"`, and a
visual box/checkmark. Structurally the same idea as `<lr-switch>` (form-associated via
`ElementInternals`, click and Space toggle) but with checkbox semantics.

**Properties:**

- `checked: boolean = false` — the live, non-reflecting state
- `defaultChecked: boolean = false` (canonical attribute `checked`, reflected) — the current reset
  default; changing it updates `checked` only while the live state is pristine
- `indeterminate: boolean = false` (reflected) — visual-only mixed state; does not affect `checked`,
  and is cleared back to `false` by any user interaction (click or keyboard), matching native
  `<input type="checkbox">`
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `name: string = ''`
- `value: string = 'on'` — only contributed to form submission while `checked` (a native checkbox
  submits nothing at all, not even an empty string, while unchecked)
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message
- `hint: string = ''` — WA supporting text below the control
- `helpText: string = ''` (attribute `help-text`) — Shoelace alias for the same supporting-text
  surface; `hint` wins when both properties are set
- `errorText: string = ''` (attribute `error-text`) — owned error text associated with the inner
  checkbox; custom markup can use the `error` slot
- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the box and its checkmark off
  the same values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a
  row. The slotted label keeps the library's standard control-label type size at every tier —
  restyle it through `::part(label)` if you want it to track the control.

**Events:** user toggles emit, in order, bubbling/composed `input`, the compatibility `lr-input`
alias, bubbling/composed `change`, then the compatibility `lr-change` alias (both aliases carry
`detail: { checked: boolean }`). Programmatic `.checked` assignments are
silent. Internal `focus`/`blur` are re-dispatched as bubbling, composed host events. `lr-invalid` (no detail) fires when a
validity check finds the checkbox invalid.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal checkbox control;
`getForm()` returns its owning form (including an external owner selected by `form`).
`setCustomValidity(message)` sets or clears a consumer-supplied error ("those terms have been
superseded"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unchecked box goes back to `valueMissing`. It
survives every toggle and a form reset; `setCustomValidity('')` or `resetValidity()` clears it.

**Slots:** default — rich label content rendered beside the semantic checkbox owner. Clicking
plain label content toggles like a native associated label; activating a nested link or button does
not toggle. If left empty, set `aria-label` on the host so the control still has an accessible
name. `hint` is the WA supporting-text slot;
`help-text` is the Shoelace spelling for the same described-by surface.
`error` supplies custom error markup on the same owned error surface as `errorText`.

The label, hint, and error wrappers can shrink and wrap at arbitrary boundaries inside a 320px LTR
or RTL allocation. The checkbox square and its shared interactive target remain fixed-size.

The default slot deliberately remains the checkbox's one visible, clickable label; there is no
separate top-of-field label property or slot. `form-control` wraps that checkbox plus its error and
hint, matching `lr-switch` without duplicating the label idiom.

The `checkbox`/`base` semantic role owner retains `--lr-icon-button-size` as its minimum inline and
block size at every tier. The visible `box` remains tied to `size`, so a label-less `2xs` checkbox
centres a compact square inside a 40px clickable target instead of inflating the glyph itself.

The label wrapper tracks flattened forwarding-slot assignment and later mutations. Its presence is
visual: an element-only icon or intentionally visible `aria-hidden` decoration keeps the wrapper,
independently of whether that node contributes to the accessible name. A host `aria-label` wins by
presence and is forwarded verbatim, including `aria-label=""`.

The internal `role="checkbox"` exposes explicit stateful `aria-invalid`. Visible property/slotted
error chrome makes it `"true"` immediately; otherwise it becomes true only after interaction while
intrinsic/custom validity fails, and explicitly returns to `"false"` when neither condition holds.

Host `aria-describedby` targets in the host's own root are resolved onto the internal
`role="checkbox"` through `ariaDescribedByElements`, so an externally-owned description remains
valid across the shadow boundary. In supporting browsers the explicit element list intentionally
leaves the internal role's serialized attribute empty; browsers without the reflected-reference
API keep the string fallback. The relationship tracks host attribute changes and clears when
unset.

**CSS parts:** `form-control` (outer checkbox/error/hint frame), `row` (the row wrapping the
checkbox owner and the label as siblings — the node to size or align when laying out a column of
checkboxes, since `base`/`checkbox` below is only the control box and its inline size tracks the box
rather than the row), `base` (compatibility name for the
semantic owner; use `checkbox`), `checkbox` (the interactive `role="checkbox"` owner; it is the
same node as `base`, while the rich default label is its sibling),
`box` / `control` (the small square showing the checkmark/indeterminate dash; while active it also
carries Shoelace's `control--checked` or `control--indeterminate` state token), `checkmark` plus
`checked-icon` or `indeterminate-icon` on the visible glyph, `label` (wrapper around the default
slot), `error`, and `hint` / `form-control-help-text` on the supporting-text wrapper.

**Themeable custom properties:** `--lr-checkbox-box-size` and `--lr-checkbox-label-indent` (both
below), plus shared tokens — `--lr-space-s`, `--lr-icon-button-size`,
`--lr-color-border/-surface/-on-brand/-brand/-text/-danger`, `--lr-radius`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.
State paint is independently themeable through `--lr-checkbox-hover-border`,
`--lr-checkbox-active-border`, `--lr-checkbox-active-ring`, `--lr-checkbox-invalid-border`,
`--lr-checkbox-checked-bg`, and `--lr-checkbox-checked-border`; every default preserves the
corresponding brand/brand-quiet/danger token.

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
_derived_ from it, so the advertised value and the real label offset cannot drift. Setting it on
the element (or on `lr-checkbox` in your own stylesheet) moves the label.

It is published so you can align your own per-option hint text under the label without re-deriving
that formula by reading the shadow styles. **But custom properties inherit down, not sideways**, so
a _sibling_ node in your tree cannot read it off the checkbox. Align a sibling by computing the
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

WA's `--checked-icon-color` and `--checked-icon-scale` aliases directly control the visible
checkmark/dash color and scale.

**Optional peer deps:** none.

```html
<lr-checkbox name="terms" required>Accept the terms and conditions</lr-checkbox>
<script type="module">
  document
    .querySelector("lr-checkbox")
    .addEventListener("lr-change", (e) => console.log(e.detail.checked));
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

- `checked` follows native dirty-state rules. A later `el.checked = true` assignment changes only
  the live state and never rewrites the attribute. Changing `defaultChecked` or the `checked`
  attribute updates the reset target but cannot overwrite a dirty live state; `form.reset()` uses
  that current default and makes the control pristine again.
- `indeterminate` is visual-only and silently clears on any user click/keypress — a consumer relying
  on it staying `true` after a user interacts with the box will be surprised.
- The rendered `aria-label` is copied from the host's own `aria-label` attribute at render time; if
  neither that nor slotted label text is present, the control has no accessible name.

---

## `lr-switch`

A boolean toggle-switch form control. `role="switch"` with `aria-checked` read as an on/off state
rather than checked/unchecked, and no indeterminate state. Structurally the same idea as
`<lr-checkbox>` (form-associated via `ElementInternals`; click and Space toggle). Enter is not a
special switch key. Logical ArrowLeft/ArrowRight set the switch off/on, mirrored under RTL.
Ships an opt-in `hint`/`errorText` form-control chrome (props + matching named slots + `hint`/`error`
CSS parts), mirroring `<lr-select>`'s pattern for those two pieces — left unset, neither renders.
Deliberately no separate top-of-field `label` prop/slot/part: the default slot already is this
control's visible, clickable label (same as `<lr-checkbox>`).

**Properties:**

- `checked: boolean = false` — the live, non-reflecting state
- `defaultChecked: boolean = false` (canonical attribute `checked`, reflected) — the current reset
  default; changing it updates `checked` only while the live state is pristine
- `disabled: boolean = false` (reflected)
- `required: boolean = false` (reflected — enforced via `internals.setValidity()`)
- `name: string = ''`
- `value: string = 'on'` — only contributed to form submission while `checked`
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message
- `hint: string = ''` — hint text below the switch. Unset: no hint chrome renders.
- `helpText: string = ''` (attribute `help-text`) — Shoelace alias for `hint`; `hint` wins when both
  are supplied
- `withHint: boolean = false` (attribute `with-hint`) — WA SSR presence hint for slotted supporting
  text that cannot be inspected until hydration
- `errorText: string = ''` (attribute `error-text`) — error text below the switch (overridden by
  slotted `error` content). Unset: no error chrome renders.
- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the track and thumb off the
  same values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a row.
  The slotted label keeps the library's standard control-label type size at every tier — restyle it
  through `::part(label)` if you want it to track the control.

**Events:** a user state change (click, Space, a logical ArrowLeft/ArrowRight change, or the
programmatic `click()` activation path) emits
`input`, then `lr-input`, then `change`, then `lr-change` (both aliases carry
`detail: { checked: boolean }`) — in that order, matching
the native checkbox/radio contract. The two native-style events are **new in 8.0.0**: a boolean
control that emitted only the `lr-`-prefixed alias was invisible to every form library, validation
helper, and `<form>`-level `change` listener that binds the native names, which is the ordinary way
a consumer observes a control they didn't write. `input` is an `InputEvent`; `change` is an
`Event`. Both bubble and compose, and neither carries a detail — read `event.target.checked`.
None of the four fires for a programmatic `.checked`
assignment, `form.reset()`, or session-state restoration. The internal control's native
`focus` and `blur` are re-dispatched as bubbling, composed host events. `lr-invalid` (no detail) fires when a validity
check finds the switch invalid.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal switch control;
focus/click and stale keyboard/pointer activation are synchronous no-ops as soon as direct or
fieldset disablement starts, even before the next render;
`getForm()` returns its owning form (including an external owner selected by `form`).
`setCustomValidity(message)` sets or clears a consumer-supplied error ("notifications are disabled
for your plan"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unchecked switch goes back to `valueMissing`. It
survives every toggle and a form reset; `setCustomValidity('')` or `resetValidity()` clears it.

`checked`/`defaultChecked` use the same native dirty-state contract as `lr-checkbox`: live writes
never reflect, default/attribute changes cannot overwrite a dirty live state, and `form.reset()`
restores the current default before making the control pristine again.

**Slots:**

- default — rich label content rendered beside the semantic switch owner. Clicking plain label
  content toggles like an associated label; activating a nested link or button does not toggle. If
  left empty, set `aria-label` on the host so the control still has an accessible name. Flattened
  forwarding-slot assignment and later mutations
  keep the visual wrapper synchronized; element-only and visible `aria-hidden` decorations retain
  it. A host `aria-label` wins by presence, including an explicitly empty value.
- `hint` — custom hint content.
- `help-text` — Shoelace alias for the same hint surface.
- `error` — custom error content.

**CSS parts:** `form-control` (the outer wrapper around the switch, error and hint), `row` (the row
wrapping the switch owner and the label as siblings — the node to size or align when laying out a
column of switches, since `base`/`switch` below is only the track box and its inline size tracks the
track rather than the row), `base` /
`switch` / `wrapper` (the semantic interactive `role="switch"` owner; the rich label is its
sibling), `track` / `control` (the
pill-shaped background), `thumb` (the circular knob), `label` (wrapper around the default slot),
`hint` / `form-control-help-text` (the hint message), and `error`.

**Themeable custom properties:** `--lr-switch-track-block-size` (default
`calc(var(--lr-form-control-height) * 0.5)`), `--lr-switch-track-inline-size` (default
`calc(var(--lr-switch-track-block-size) * 1.8)`, the 1.8:1 aspect ratio the control has always had)
and `--lr-switch-thumb-offset` (default `var(--lr-size-2px)`) — component-local geometry knobs set
on `:host`, since a fully-rounded pill/thumb needs a radius well past the shared `--lr-radius`
default. Both track dimensions ride the shared `size` ladder, so at the default `m` tier they
resolve to exactly the `1.25rem` × `2.25rem` the switch shipped with before it had a `size` at all.
WA/Shoelace's `--width`, `--height`, and `--thumb-size` aliases feed those same rendered dimensions.
`--lr-switch-gap` (default `var(--lr-space-s)`) independently controls the track-to-label gap.

`--lr-switch-track-fill` (default `--lr-color-border`) is `[part='track']`'s unchecked resting
fill. `--lr-switch-checked-track-fill` (default `--lr-color-brand`) independently retints its
checked fill, and `--lr-switch-track-hover-fill` / `--lr-switch-track-active-fill` independently
retint the pointer states (their defaults remain mixes from the current resting fill).
`--lr-switch-thumb-fill` (default `--lr-color-surface`) controls the thumb in either state. None of
these hooks touches the label text beside the track. Plus shared tokens
`--lr-space-s`, `--lr-color-border/-brand/-surface/-text`,
`--lr-transition-fast`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-switch name="notifications" checked>Enable notifications</lr-switch>
<script type="module">
  import "@aceshooting/lyra-ui/components/forms/switch/switch.js";
  const sw = document.querySelector("lr-switch");
  sw.addEventListener("lr-change", (e) => console.log(e.detail.checked)); // prefixed alias
  sw.addEventListener("change", (e) => console.log(e.target.checked)); // native-style, no detail
</script>
```

Form-associated the same way as `<lr-checkbox>`: a directly-attached `ElementInternals` with a
hand-rolled `updateValidity()`, not the shared `FormAssociated` mixin. The thumb animates the
logical `inset-inline-start` property (not a physical `transform: translateX()`), so the slide
direction mirrors correctly under `dir="rtl"`.
Session-history/autofill restoration uses the same explicit `checked`/`unchecked` state tokens as
checkbox and does not emit `lr-change`.

**Known gotchas:**

- `checked` is live and dirty; `defaultChecked`/the `checked` attribute is the current reset default.
  A later `.checked = true` never redefines what `form.reset()` restores to. Shoelace's
  Only the canonical `checked` attribute and property-only `defaultChecked` IDL define that reset
  default.
- The rendered `aria-label` is copied from the host's own `aria-label` attribute at render time; with
  neither that nor slotted label text, the control has no accessible name.

---

## `lr-slider`

A numeric range control (e.g. an LLM "temperature" setting). **Form-associated** directly through
`ElementInternals`, because its public `value` is a number rather than the string assumed by the
shared form mixin. `value`, `defaultValue`, and `valueAsNumber` are numeric; `valueAsString` is the
explicit compatibility round-trip for code that still wants a serialized value. Clicking anywhere
on `[part~="base"]` (not just the thumb) jumps the
thumb to that point and continues the same gesture as a drag, matching native `<input type=range>`
click-to-seek — the thumb is also `.focus()`ed on that click, so keyboard interaction can continue
seamlessly right after. Mirrors the core `<wa-slider>` API under the `lr-` prefix.

**Two-handle `range` mode.** `range` turns the control into a selection between `minValue` and
`maxValue`, defaulting to `0`/`50`. Each handle is a separately focusable `role="slider"` with its
own localized accessible name and the full domain as its reachable range. When the active handle
crosses its sibling, it pushes that sibling to the same value instead of stopping, so the active
thumb remains under the pointer/key. A track click moves whichever handle is nearer the clicked
position. `[part~="base"]` then carries `role="group"`, named from
`label`/`aria-label`, so the pair is announced as one control.

Switching `range` while the outgoing handle owns focus transfers focus to the equivalent replacement
(single value to lower handle; either range handle to single value) without reclaiming newer
external focus. A mode switch during a pointer drag releases capture and cancels that gesture
without an extra commit.

A named range slider submits **two same-name entries**, lower then upper. For example,
`<lr-slider range name="window">` contributes `window=0&window=50` by default. Read both with
`formData.getAll('window')`; `get()` returns only the first entry. Turning `range` off restores the
single numeric string entry.

**Properties:**

- `min: number = 0`
- `max: number = 100`
- `step: number = 1` — a zero or negative value is kept as an explicit "unstepped" mode
- `range: boolean = false` (reflected) — two-handle mode; see above
- `minValue: number = 0` (attribute `min-value`) — the lower handle's value in `range` mode.
  Assigning past `maxValue` pushes `maxValue` to the same number
- `maxValue: number = 50` (attribute `max-value`) — the upper handle's value. Assigning below
  `minValue` pushes `minValue` to the same number. Only the `min-value`/`max-value`
  _attributes_ are captured as the `form.reset()` defaults, so a later property assignment never
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
- `withMarkers: boolean = false` (attribute `with-markers`) — draws a tick mark at every
  `step` position along the track. Purely decorative (`aria-hidden`). Nothing is drawn for an
  unstepped grid (`step` ≤ 0) or for one implying more than 100 intervals — ten million ticks would
  be visually indistinguishable and would hang the page, so the grid is dropped rather than
  half-drawn
- `withTooltip: boolean = false` (attribute `with-tooltip`) — shows a live value bubble
  above each handle while that handle is focused or being dragged. Its text is `valueFormatter`'s
  result when one is supplied, otherwise the locale-formatted number
- `label: string = ''`, `hint: string = ''`, and `errorText: string = ''` (attribute `error-text`) —
  visible form context around the track, with matching rich `label`/`hint`/`error` slots. A host
  `aria-label` wins for the interactive accessible name by attribute presence, including an
  explicitly empty value; range mode then suppresses `aria-labelledby` on its group owner as well.
  When error and hint content are both present, every handle's `aria-describedby` references the
  error first and the hint second. Rich slotted error content replaces the plain `errorText` copy.
- `helpText: string = ''` (`help-text`) and the `help-text` slot are Shoelace aliases for `hint`.
- `withLabel: boolean = false` / `withHint: boolean = false` (`with-label`/`with-hint`) are SSR
  presence hints; hydrated instances also discover populated slots automatically.
- `indicatorOffset?: number` (`indicator-offset`) — single-slider fill origin. The indicator spans
  between this number and `value`, whichever is lower.
- `autofocus: boolean = false` — focuses the first/lower thumb after the first client render.
- `tooltipPlacement: 'top' | 'right' | 'bottom' | 'left' = 'top'` and
  `tooltipDistance: number = 8` control physical tooltip layout in either orientation and RTL.
- `tooltip: 'top' | 'bottom' | 'none' = 'none'` and `tooltipFormatter?: (value) => string` are
  Shoelace-compatible aliases layered over the richer Lyra/Web Awesome tooltip surface.
- `valueFormatter?: SliderValueFormatter` (attribute: false) —
  `(value: number, handle: 'value' | 'min' | 'max') => string | null | undefined`. Maps the finite,
  clamped `aria-valuenow` number to optional human-readable `aria-valuetext`, and supplies the
  `with-tooltip` bubble's text. The second argument identifies which handle is being formatted
  (`'value'` on a single-handle slider). A nullish result omits `aria-valuetext`. Leaving the
  property unset preserves the numeric `aria-valuetext`.
- `showValue: boolean = false` (attribute `show-value`) — opt-in numeric readout next to the track;
  a range readout joins both values with an en dash. The explicit HTML spelling
  `show-value="false"` stays false.
- `value: number = 0`, `defaultValue: number = 0` (attribute `value`), `valueAsNumber: number`, and
  `valueAsString: string` are synchronized, finite, clamped, and step-snapped.
- `isRange: boolean` is the read-only normalized range-mode state.
- `name: string | null = null`, `disabled = false`, `required = false`, reflected `customError`,
  plus read-only `form`, `labels`, `validity`, `validationMessage`, and `willValidate` make up the
  native form surface.

**Events:** native-style `input` (no detail), then `lr-input`, fire continuously during an active
drag or keyboard step, including OS key-repeat while a key is held. Native-style `change` (no
detail), then `lr-change`, fire once an interaction commits: on pointerup for a drag, or on keyup
for a keyboard step, so a single Arrow/Home/End/PageUp/PageDown press fires both pairs, mirroring
native `<input type=range>` timing.
The focused handle's native `focus` and `blur` are re-dispatched from the host as bubbling,
composed events.
`lr-invalid` (no detail) fires when a validity check finds the slider invalid.
**Breaking in 8.0.0:** both details widened from `{ value: number }` to
`{ value: number; minValue: number; maxValue: number; handle: 'value' | 'min' | 'max' }`. `value` is
the value of the handle that moved and `handle` says which one that was (`'value'` on a
single-handle slider); `minValue`/`maxValue` always carry both range-handle positions. Existing
`e.detail.value` readers keep working unchanged.

**Methods:** `focus(options?)` and `click()` forward to the first/lower thumb; `blur()` releases the
thumb that actually owns focus. `stepUp(steps = 1)` / `stepDown(steps = 1)` silently move the
focused handle (first/lower when none is focused). `getForm()`, `checkValidity()`,
`reportValidity()`, `setCustomValidity(message)`, and `resetValidity()` mirror native form-control
methods.

**Slots:** `label`, `hint`, Shoelace alias `help-text`, `error`, and `reference`. Empty chrome stays
hidden and contributes no accessible relationship.

The standalone slider has a zero intrinsic flex minimum and a 100% allocation ceiling. Its label,
reference, error, and hint regions wrap even unbroken content in LTR and RTL; the fixed numeric
readout and track remain contained. An exact-320px story covers this composition.

**CSS parts:** `base slider form-control form-control-input input control` are tokens on the
interactive row (`role="group"` in range mode). `label form-control-label` share the visible label
node; `references` wraps the endpoint/unit slot; `error` is the error node; and
`hint form-control-help-text` share the hint node.
`track` is the full-length line; `indicator` is the filled portion from `min` up to the current
value, or between the two handles in `range` mode.
`markers` (the tick container, present only with `with-markers`) and `marker` (one `step`-grid
tick), `thumb` (a draggable handle, `role="slider"` — present on every handle including both range
ones), `thumb-min` and `thumb-max` (the lower and upper range handles; each carries `thumb` as
well, so `::part(thumb)` styles both while `::part(thumb-min)` reaches only one), `tooltip` (the
live value bubble per handle, present only with `with-tooltip`), `tooltip-visible` (added _to the
`tooltip` element's part list_ while that handle is focused or dragged — visibility is encoded in
the part name because `::part(tooltip)[data-visible]` is invalid CSS and never matches; write
`::part(tooltip-visible)`). The tooltip also exposes `tooltip__tooltip`, `tooltip__content`, and
`tooltip__arrow`. `value` is the opt-in numeric readout.

**CSS custom states:** `disabled`, `dragging`, `focused`, `required`, `optional`, `valid`,
`invalid`, `user-valid`, and `user-invalid`. A slider always has a finite numeric value, so
`required` is still useful as a styling hook but does not by itself make the control invalid;
`setCustomValidity()` controls the invalid states.

**Breaking in 8.0.0:** the `fill` part was **renamed to `indicator`**, matching `wa-slider`. A
`::part(fill)` rule silently matches nothing now — rename it.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
the `form-control-label` node — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. With no label text the node is hidden and no glyph is
painted. It is purely a visual convention here, for the reason the custom states note above gives:
a slider always has a value, so the marker never accompanies a `valueMissing` violation.

**Themeable custom properties:** three geometry knobs ride the shared `size` ladder, so a tier moves
them all without a per-tier rule, and the values in brackets are what they resolve to at the default
`m`:

`--lr-slider-gap` (default `var(--lr-space-s)`) controls the row/column gap between the track,
value readout, label, references, error, and hint as those flex items wrap.

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
consumer value set on any ancestor is never shadowed. `--lr-slider-tooltip-distance` carries the
finite, unit-resolved tooltip offset computed from `tooltipDistance`; set `tooltipDistance` rather
than overriding this runtime value. The thumb has independent paint hooks:
`--lr-slider-thumb-bg` (default `var(--lr-color-brand)`), `--lr-slider-thumb-border-color`
(default `var(--lr-color-surface)`), `--lr-slider-thumb-hover-ring-color` (default
`var(--lr-color-brand-quiet)`), and `--lr-slider-thumb-active-ring-color` (defaulting through the
hover ring). Everything else is shared tokens —
`--lr-space-s`, `--lr-color-border/-brand/-surface/-text-quiet`, `--lr-shadow`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

Mapped aliases are also live: `--thumb-size`, `--thumb-width`, `--thumb-height`, `--track-height`,
`--track-size`, `--track-color-active`, `--track-color-inactive`, `--track-active-offset`,
`--tooltip-offset`, `--marker-width`, and `--marker-height`.

**Optional peer deps:** none.

```html
<lr-slider
  id="temperature-slider"
  name="temperature"
  min="0"
  max="2"
  step="0.1"
  label="Temperature"
  hint="Higher values make replies more varied."
  with-markers
  with-tooltip
></lr-slider>

<!-- Two handles, vertical. A name submits two `price` entries. -->
<lr-slider
  id="price-slider"
  range
  name="price"
  orientation="vertical"
  min="0"
  max="1000"
  step="50"
  min-value="200"
  max-value="800"
  label="Price"
></lr-slider>
<script type="module">
  const temperature = document.getElementById("temperature-slider");
  temperature.valueAsNumber = 0.7;
  temperature.valueFormatter = (value, handle) => `${value * 100}%`;
  temperature.addEventListener("lr-input", (e) => setDraftTemperature(e.detail.value));
  temperature.addEventListener("lr-change", (e) => commitTemperature(e.detail.value));

  const price = document.getElementById("price-slider");
  price.addEventListener("lr-change", (e) => applyPriceFilter(e.detail.minValue, e.detail.maxValue));
</script>
```

An unset `value` starts at numeric `0`, clamped into the configured domain and step grid. A reset
restores the numeric `defaultValue` sourced from the `value` content attribute, or the same zero
default when the attribute was absent. A slider therefore always represents a number; `required`
is present for upstream form-surface parity but adds no missing-value constraint.

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
- A named `range` slider contributes two same-name entries. Use `FormData#getAll()`, not `get()`,
  when both values are required.
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
  minimum at **every** tier, while a 40px _visible_ thumb would make two range handles overlap
  across 40px of track and hijack track clicks. The pseudo-element has no DOM node of its own, so a
  pointerdown inside it still reports the thumb as `e.target`.

---

## `lr-radio`

A form-associated single-choice control. Use it alone or inside `lr-radio-group`.

**Properties:** live, non-reflecting `checked`; reflected `defaultChecked` (attribute `checked`);
reflected `customError: string | null` (attribute `custom-error`); `disabled`, `required`, `name`,
and `value`. A selected standalone radio submits its value through `ElementInternals`.
An empty `name` is canonicalized to an omitted attribute rather than reappearing as `name=""`.
`effectiveRequired` exposes the required state inherited from a containing radio group.
`effectiveName` and `effectiveSize` expose the owning group's aggregate projections while `name`
and `size` remain the option's authored state; late writes survive removal, reparenting, and group
disconnect/reconnect. `focus()`,
`blur()`, and `click()` forward to the internal radio control; `getForm()` returns the standalone
radio's owning form and the aggregate group's owning form while the radio is group-owned.

- `size: LyraSize = 'm'` (reflected) — control size on the shared ladder, accepting both
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`. It scales the indicator off the same
  values `lr-input`/`lr-select`/`lr-button` read, so controls of one `size` line up in a row. The
  slotted label keeps the standard control-label type size at every tier — restyle it through
  `::part(label)` to make it track the control.
- `appearance: 'default' | 'button' = 'default'` (reflected) — WA's button presentation on the
  same `<lr-radio>` tag; it retains radio semantics, group ownership, value, and events
- `pill: boolean = false` (reflected) — rounds the control's own chrome into a pill instead of the
  shared control radius. A plain `<lr-radio>`'s indicator is a circle at every setting, so this is
  visible on `<lr-radio-button>`, which inherits this class and renders rectangular chrome; it is
  declared here so both tags carry one property with one meaning.

`setCustomValidity(message)` sets or clears a consumer-supplied error ("that plan is no longer
available"): a non-empty message raises `customError` and blocks submission, `''` restores the
control's own computed validity so a required-and-unselected radio goes back to `valueMissing`. It
survives every selection, every group-driven `required` change, and a form reset. A standalone
radio owns the error itself; an owned radio delegates it to the form-associated aggregate group.
`resetValidity()` clears the error through that same standalone-or-group owner.

`checked` follows native dirty-state semantics: changing `defaultChecked`/the `checked` attribute
updates the current reset default without overwriting a dirty live selection, and `form.reset()`
restores the current default.

**Events:** a standalone selection emits, in order, native-style composed `input`, `lr-input`,
native-style composed `change`, then `lr-change`; both aliases carry `{ checked, value }`. An owned
radio emits none of those child value events; its group emits the sole aggregate sequence described
below, so capture and bubble listeners cannot observe two differently shaped event sets. The
internal control's native `focus` and `blur` are re-dispatched as bubbling, composed host events.
`lr-invalid` (no detail) belongs to the standalone radio; an aggregate group emits its own alias.

**Slots:** default label content. In `appearance="button"`, `start`/`prefix` share the leading
wrapper and `end`/`suffix` share the trailing wrapper, matching `lr-radio-button`; changing away
from button appearance does not remove or rewrite the authored light-DOM content. Flattened
forwarding-slot assignment and later mutations keep the visual label wrapper synchronized;
element-only and visible `aria-hidden` decorations retain it. A host `aria-label` wins on the
internal radio by presence, including `aria-label=""`.

A standalone radio stays within its allocated inline size. Long or unbroken default labels wrap in
LTR and RTL while the indicator retains its fixed geometry; an exact-320px story covers both.

**CSS parts:** default appearance: `base`, `circle` / `control` (with Shoelace's
`control--checked` state token), `dot` / `checked-icon`, and `label`. Button appearance: `base`,
`button`, `control`, `button--checked` while selected, `start` / `prefix`, `label`, and `end` /
`suffix`. Empty leading, label, and trailing wrappers are hidden independently, so only present
content contributes `--lr-radio-button-gap` spacing.
Every `<lr-radio-button>` size tier keeps its interactive base at least 24px in both axes, including
an empty-label control; the visible density can still grow with the shared size ladder.

**Themeable custom properties:**

- `--lr-radio-circle-size` (default `min(var(--lr-icon-button-size), calc(var(--lr-form-control-height)
  - 0.7))`; `1.75rem`at the default`m`tier) — the edge length of`[part='circle']`, derived from
the active `size`tier's shared control height so a radio lines up with an`lr-input`/`lr-select`/`lr-button`of the same`size`.
- `--lr-radio-dot-size` (default `min(calc(var(--lr-radio-circle-size) * 0.5),
calc(var(--lr-form-control-height) * 0.3))`; `0.75rem` at `m`) — the edge length of `[part='dot']`,
  capped at half the circle so it can never outgrow its ring, whatever is done to either the ladder
  or the `--lr-icon-button-size` cap.
- `--lr-radio-radius` (default `--lr-radius-pill`) — the corner radius of the control's own chrome.
  A circular indicator is fully round at every setting; `<lr-radio-button>` changes the private
  default to the shared control radius and `pill` changes it back to a pill. An inherited or direct
  public value wins throughout.
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
The pointer states are independently themeable with `--lr-radio-hover-border-color` (default
`var(--lr-color-brand)`), `--lr-radio-active-border-color` (defaulting through the hover border),
and `--lr-radio-active-ring-color` (default `var(--lr-color-brand-quiet)`).
WA's `--checked-icon-color` and `--checked-icon-scale` aliases feed the selected indicator's color
and scale.

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

Standalone button chrome is allocation-safe too: unbroken labels wrap, and start/end (or retained
prefix/suffix) adornments are each capped and truncate rather than widening the containing panel.
The exact-320px story shows that behavior in LTR and RTL.

**Properties and methods:** exactly the same functional surface as `lr-radio`. Its writable fields
are `appearance`, `checked`, `defaultChecked`, `customError`, `disabled`, `name`, `required`, `value`,
`size`, and `pill`. Its effective form/validity state is also inherited: read-only
`effectiveDisabled`, `effectiveRequired`, `form`, `labels`, `validity`, `validationMessage`, and
`willValidate`. The delegated methods are `click()`, `focus()`, `blur()`, `getForm()`,
`checkValidity()`, `reportValidity()`, `setCustomValidity()`, and `resetValidity()`; form reset,
disabled-fieldset, and state-restoration callbacks remain the browser-owned FACE integration behind
those public operations. Its inherited strongly typed `addEventListener()` and
`removeEventListener()` overloads cover the radio event map listed below while retaining the
standard DOM string overloads. The inherited `appearance` remains `'default' | 'button'`; this tag already
renders button chrome in either state, so the property adds no second visual mode. `size` is where this
chrome differs most visibly: the shared ladder drives the button's height (floored at `1.5rem`),
inline padding and font size, so a `size="small"` radio button sits at the same height as a
`size="small"` `lr-button` beside it. `pill` is the one inherited property that does _more_ here
than on a plain `lr-radio` — see the radius note below.

The inherited derived reads `effectiveName` and `effectiveSize` expose the resolved group name and
size used by the button's form and chrome logic.

**Events:** identical to `lr-radio` — a standalone selection emits `input`, `lr-input`, `change`,
then `lr-change` (both aliases carry `{ checked, value }`); an owning `lr-radio-group` emits the
aggregate sequence instead. The internal control's `focus` / `blur` are re-emitted because they do
not cross the shadow boundary. `lr-invalid` (no detail) belongs to a standalone radio button; an aggregate group emits
its own alias.

**Slots:** default (label text), `start` (leading content, typically an icon), and `end` (trailing
content). Shoelace's `prefix` and `suffix` are retained as aliases for `start` and `end`,
respectively; either spelling can be used, and both spellings share one wrapper at each edge.
The leading, label, and trailing wrappers are hidden independently while empty, so missing regions
do not contribute dead flex gaps.
Host `aria-label` is forwarded to the internal radio by attribute presence, including
`aria-label=""`; it is not replaced by the visible default-slot text.

**CSS parts:** `base` / `button` / `control`, `start` / `prefix` (the same leading wrapper),
`label`, and `end` / `suffix` (the same trailing wrapper). The interactive node carries `checked`
and `button--checked` when selected, plus `disabled` under own, group, or fieldset disablement,
because an attribute selector
after `::part()` never matches.

**Themeable custom properties:** `--lr-radio-radius` is the one inherited knob this element really
uses. `lr-radio` gives it a private `--lr-radius-pill` default for its circular indicator; this
subclass changes that private default to `--lr-form-control-radius` — the active `size` tier's
shared corner radius — and `pill` changes it back to `--lr-radius-pill`. An inherited or direct
public value wins. Only the _outer_ corners of an actually contiguous run take it: an
owning horizontal group measures same-line adjacency after layout, then collapses shared borders.
The ordinary group gap, a plain-radio interruption, vertical layout, or a flex wrap starts a new
fully rounded run, and live add/remove/reorder plus LTR/RTL changes are reconciled. Standalone
siblings are never guessed into a run. `--lr-radio-button-gap` (default `var(--lr-space-xs)`) controls the
spacing between the start/prefix wrapper, label, and end/suffix wrapper in both `<lr-radio-button>`
and `<lr-radio appearance="button">` without changing the shared spacing token used elsewhere.
Button paint states can be rethemed without changing shared tokens:
`--lr-radio-button-hover-bg` / `--lr-radio-button-hover-border-color` and
`--lr-radio-button-active-bg` / `--lr-radio-button-active-border-color` control the unchecked
pointer states; `--lr-radio-button-checked-bg`, `--lr-radio-button-checked-border-color`, and
`--lr-radio-button-checked-color` control checked rest; and the corresponding
`--lr-radio-button-checked-hover-bg`, `--lr-radio-button-checked-hover-border-color`,
`--lr-radio-button-checked-active-bg`, and `--lr-radio-button-checked-active-border-color` hooks
control checked pointer states. The inherited `--lr-radio-hover-border-color`,
`--lr-radio-active-border-color`, and `--lr-radio-active-ring-color` remain visible in generated
metadata but apply only to the base radio's circular chrome. All fallbacks preserve the existing
brand, on-brand, quiet, and color-mix treatments.

Because this is a subclass, the manifest also lists `lr-radio`'s own `circle` and `dot` parts and
its `--lr-radio-circle-size`, `--lr-radio-dot-size`, `--lr-radio-label-indent`,
`--lr-radio-checked-border-color` and `--lr-radio-checked-dot-color` custom properties. **This
element renders none of those** — it draws a button, not a circle and dot — so styling them here has
no effect. The same is true of the inherited `checked-icon` and `control--checked` parts and the
`--checked-icon-color` / `--checked-icon-scale` aliases. They are inherited declarations, not
rendered button surface. `--lr-radio-radius` is the exception, and
the only one of the set worth setting on this tag.

```html
<lr-radio-group name="view" label="View" orientation="horizontal">
  <lr-radio-button value="day" checked>Day</lr-radio-button>
  <lr-radio-button value="week">Week</lr-radio-button>
</lr-radio-group>
```

---

## `lr-otp-input`

A form-associated one-time-code field: several character segments that together hold one value.
Mirrors `wa-otp-input`.

The segments are **presentational**. A single real `<input>` sits transparently across them and owns
focus, selection and the value. It remains the native integration point for SMS autofill
(`autocomplete` defaults to `one-time-code`), IME composition and mobile keyboards, and keeps the
control to one tab stop rather than one per character. Fixed-cell keyboard and paste handlers map
those native editing intents into the visual cells without exposing one input per character.

Every live-value path — typing, paste, autofill, a `value` assignment, pristine default propagation,
form reset, browser state restoration, or a narrowing `type` change — funnels through one sanitizer,
so none of them can produce a value another could not. Characters the current `type` rejects are
dropped silently: pasting or assigning `"ABC-123"` to a numeric field yields `123`. Programmatic,
reset, and restoration paths remain event-silent and preserve native dirty/default-value semantics.

Public `--lr-otp-input-*` theme inputs stay undeclared on the host, so an ancestor theme wrapper
can override appearance fallbacks; a value set directly on the element still wins.

**Properties:** `label`, `hint`, `errorText` (`error-text`);
`appearance: 'outlined' | 'filled' | 'filled-outlined' | 'contained' = 'outlined'` (reflected);
`autofocus: boolean = false`; `autosubmit: boolean = false` (reflected);
`size: LyraSize = 'm'` (reflected after an explicit property/attribute write, accepting
`2xs`/`xs`/`s`/`m`/`l`/`xl` and the shared aliases). While unset, its generic font/radius/height
slots inherit a containing control's size context; standalone font and radius rendering falls back
to `m`. Explicitly writing even the same-default `m` pins the `m` mapping, and removing the
attribute restores contextual inheritance;
`length: number = 6` (reflected); `format: string = ''` — `#` marks a segment and any
other character becomes a literal separator (`format="###-###"`), overriding `length`. Only the
first 4,096 UTF-16 code units are parsed;
`type: 'numeric' | 'alpha' | 'alphanumeric' = 'numeric'` (reflected, also drives `inputmode`);
`case: 'preserve' | 'upper' | 'lower' = 'preserve'` (reflected); `mask: boolean = false` masks entered
characters, while `withMask: boolean = false` (`with-mask`) independently paints the mask glyph in
empty segments. With only `with-mask`, entered characters remain visible; with both properties,
filled and empty segments paint the glyph. Both are display-only, so `value` and screen-reader text
are unaffected. `readonly: boolean = false`; `autocomplete: string = 'one-time-code'`; plus the shared
form-associated surface (`name`, `value`, `defaultValue`, `customError` (`custom-error`), `disabled`,
`required`, `form`, `validity`, `validationMessage`, `willValidate`, `getForm()`, `checkValidity()`,
`reportValidity()`, and `setCustomValidity()`).

**Methods:** `focus()`, `blur()`, `click()`, `select()`,
`setSelectionRange(start, end, direction?)`, `setRangeText(replacement, start?, end?, selectMode?)`,
`clear()`, `resetValidity()`, and `formStateRestoreCallback(state, reason)`. `clear()` empties a
nonempty code, emits `lr-clear`, and returns focus to the real input. `resetValidity()` clears only
a consumer-supplied custom error and recomputes the intrinsic required/completeness constraints.
The browser restoration callback sanitizes string state and restores unsupported state shapes as
the empty value. `select()` selects the real compact-string value; typing replaces its selected
occupied cells at the first selected cell, while Backspace/Delete clears them in one edit.
`setRangeText()` bounds both the current native value and replacement before applying a
programmatic compact-string edit through the same character, case, and length sanitizer as every
other value path, synchronizes the visual cells, submitted value, and validity, and emits no
user-input event. When sanitizing removes a replacement character, the
returned selection offsets are remapped onto the accepted compact string.

**Read-only:** `input: HTMLInputElement | null` exposes the real native input and
`validationTarget: HTMLInputElement | null` exposes the same element as the native validation-UI
anchor. Both are `null` before the component connects and renders. `effectiveLength: number`
reports how many segments are actually rendered: a valid
`format`'s `#` count, else `length`, clamped to 1–32. A nonempty format whose bounded
4,096-code-unit prefix contains no `#` is treated as unset, so `length` supplies the segments and
no literal-only row renders. Literal runs are
coalesced into one separator cell; output is still bounded to 32 segments. Value sanitization
likewise inspects at most the first 4,096 UTF-16 code units and stops earlier as soon as the
effective length is filled. This is the number `value` is truncated to and the field is validated
against, so read it instead of re-deriving it from `length`.

**Selection facade:** `selectionStart`, `selectionEnd`, and `selectionDirection` forward native
compact-string getters and setters; each reads `null` before the input renders, and pre-render
writes and range-method calls are safe no-ops. Native selection, Home/End, click/pointer caret, and
host facade changes all move the fixed-cell keyboard target, so printable, Delete, and Backspace
edit the cell at the live compact caret rather than a stale internal index.

**Events:** native `InputEvent` `input` (including editing payload), native `Event` `change`, and
`lr-clear` (no detail) when a nonempty field is cleared by the user or `clear()`. Fixed-cell edits
emit `input` immediately and one `change` when the field settles on blur or Enter. Intermediate IME
composition events stay on the real input without sanitizing or committing; the final
non-composing input commits and relays once. `lr-complete` (`detail: { value }`) fires only on an
incomplete-to-complete transition, so replacing a filled cell does not complete again. It always
bubbles, composes, and is cancelable. With `autosubmit`, the component submits its owning form
after the event unless a listener calls `preventDefault()`. That submission is deferred one task,
so a listener that decides asynchronously (`await`-ing a check before letting the form go) can
still veto it; it then goes through the same resolved default button as Enter-to-submit, so
`SubmitEvent.submitter` and the button's own `name`/`value` reach the submission. The real input's native
`focus` and `blur` are re-dispatched from the host as bubbling, composed events since the originals
do not cross the shadow boundary. Replacing the live or default code, resetting/restoring the form state, or disconnecting
the component before the deferred task runs retires that completion's submission; a task for code
A can never submit a later full code B.
`lr-invalid` (no detail) fires when a validity check finds the one-time-code input invalid.
Programmatic value/default/reset/state-restoration writes do not emit `input`, `change`, or
`lr-complete`.

**Keyboard and paste:** Left/Right move through visually adjacent fixed cells, with the index delta
mirrored in RTL. Backspace clears the current cell and moves back; Delete clears it in place.
Neither operation shifts later characters. Typing replaces the active cell and advances. A
nonempty native selection maps its compact-string offsets back to occupied visual cells: typing
replaces the selection at its first cell, while either deletion key clears every selected cell.
A bare Enter flushes a pending `change` and requests exactly one submission from the owning form,
through the shared Enter-to-submit gate above — so a modifier-held Enter, an Enter that commits an
IME candidate, an already-vetoed keydown, and a `readonly` field all leave the form alone, and the
keystroke itself is never cancelled. Pasting
fills accepted characters from the first cell in one input operation. The public and submitted
`value` concatenates occupied cells; a middle hole is a visual editing state and is not encoded in
that string.

**Slots:** `label` and `hint` provide rich content when their matching attributes are empty; a
nonempty `label`/`hint` attribute wins when both sources are supplied. The `error` slot replaces
`errorText` when both are supplied. Sources are never concatenated.

**CSS parts:** `base` / `form-control` (aliases on the outer wrapper), `label` /
`form-control-label` (aliases on the label), `field` / `segments` (aliases on the segment wrapper),
`control` (the real, transparent input), `segment`, `separator` / `segment-literal` (aliases on
separators), `hint`, and `error`. A populated required label paints the shared required marker —
the same `::after` rule and the same three properties every other labelled control uses (see "The
required-field marker" above), not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here too.
`segment` carries `active`, `masked`, `placeholder-mask`, and `invalid` as additional part tokens.

**Themeable custom properties:** `--mask-char` (mapped mask-glyph alias, defaulting to the retained
`--lr-otp-input-mask-char`; the value must be a _quoted_ CSS string), `--segment-border-radius`
(default `var(--lr-form-control-radius, var(--lr-radius))`), `--segment-gap` (default
`var(--lr-space-xs)`, ignored by `contained`), and `--segment-size` (default `2.5em` at standalone
`size="m"`), which is the exact inline and block size of each non-shrinking cell. The segment row,
rather than each cell, carries the shared minimum target floor and becomes horizontally scrollable
when the allocated inline size is too small; label, hint, and error copy wrap within that allocation.
The exact-320px RTL story covers an eight-cell row and an unbroken localized label while retaining
horizontal reachability for every cell.
The internal role token `--lr-otp-input-segment-size` supplies that `2.5em` default and can be
retuned through `--lr-theme-otp-input-segment-size` when the `--segment-size` override is absent.

The retained per-cell hooks are `--lr-otp-input-segment-fill` (default `transparent`),
`--lr-otp-input-segment-border-color` (default `var(--lr-color-border)`), and
`--lr-otp-input-segment-radius` (defaulting through `--segment-border-radius` to the shared
form-control radius). `filled` uses the raised-surface fill with a transparent cell border;
`filled-outlined` adds the shared border; `outlined` keeps the transparent fill and shared border.
`contained` makes individual cells transparent, borderless, square segments inside the single
raised, bordered row whose radius remains controlled by `--segment-border-radius`.
Active and invalid states are independently themeable through
`--lr-otp-input-active-border-color`, `--lr-otp-input-active-ring-color`, and
`--lr-otp-input-invalid-border-color`, with the shared focus and danger colors retained as
fallbacks.

**CSS custom states:** `--blank`, `--filled`, `disabled`, and `readonly`, plus the shared
form-associated validity states.

**Validation:** a partially-entered code reports `tooShort` with the localized `otpInputIncomplete`
message; `required` and empty reports `valueMissing`. Intrinsic invalid segment styling and the
internal input's intrinsic `aria-invalid` state wait until the user types, blurs, or reports
validity. Explicit `errorText` or `error`-slot chrome renders immediately, is referenced by
`aria-describedby`, and makes the internal input `aria-invalid="true"` immediately, matching the
other Lyra form controls. `readonly` suspends intrinsic required/completeness validity while the
control cannot be edited and restores the current intrinsic result when editing is enabled again.

```html
<lr-otp-input
  label="Verification code"
  required
  error-text="Enter the code we sent you."
></lr-otp-input>
<lr-otp-input
  label="License key"
  type="alphanumeric"
  case="upper"
  format="####-####-####"
></lr-otp-input>
<form>
  <lr-otp-input
    name="code"
    label="PIN"
    length="4"
    appearance="contained"
    autosubmit
  ></lr-otp-input>
</form>
```

---

## `lr-radio-group`

A labeled, keyboard-navigable group of `lr-radio` controls. Home/End and the orientation's arrow
axis move focus and select the next enabled radio: Up/Down when vertical, Left/Right when
horizontal. Horizontal direction mirrors under RTL, and disabled options are skipped.

**Properties:** `label`, `hint`, `helpText` (`help-text`, Shoelace alias), `errorText`
(`error-text`), `name` (empty by default, with the empty attribute omitted), live `value`, reflected
`defaultValue` (attribute `value`; Shoelace's `default-value` is also accepted), `customError`
(`custom-error`), `required`, `disabled`, `orientation: 'vertical' | 'horizontal' = 'vertical'`,
`withLabel`/`withHint` (`with-label`/`with-hint` SSR presence hints), `aria-label` (through
`accessibleLabel`; attribute presence wins, including `aria-label=""`, and suppresses the
visible-label `aria-labelledby` fallback), and `size: LyraSize = 'm'` (reflected) — the size of the
group's **own** chrome, on the shared ladder and accepting both `2xs`/`xs`/`s`/`m`/`l`/`xl` and
`small`/`medium`/`large`. It scales the group's label type size and the gaps around and between its
options off the same values the controls themselves use, and projects that tier to every owned
`<lr-radio>`/`<lr-radio-button>` child (including children added later). Group size and name are
authoritative through each option's `effectiveSize`/`effectiveName`, but never rewrite the child's
authored public properties or attributes; late child writes are restored immediately on removal or
reparenting.

The group is the sole aggregate form-associated owner. A non-empty selected value contributes one
`name=value` entry; owned radios suppress their own entries and validity while a standalone radio
continues to participate independently. `form`, `getForm()`, `labels`, native validity, external
form ownership, fieldset disablement, reset, and session restoration all live on the group.
`value` is non-reflecting live state; `defaultValue`/the `value` attribute is the current reset
default and cannot overwrite a dirty selection. Reset restores that current default, and session
restore selects the stored value silently even when it arrives before the radio children.

**Events:** per owned selection — including keyboard activation — the group emits, in order,
a bubbling/composed `InputEvent` named `input`, `lr-input`, a bubbling/composed `Event` named
`change`, then exactly one group-owned `lr-change`. The two native events carry no detail (read
`event.target.value`);
both prefixed aliases carry `{ value, radio }`. The selected child does not emit its standalone
value events. Ownership is resolved synchronously, so immediate removal restores standalone
behavior and immediate reparenting routes the event to the new group without waiting for a
mutation-observer turn. `lr-invalid` (no detail) is group-owned and fires when the group's validity
check fails; a consumer listening above the group does not receive a second prefixed alias from the
child validity owner.

**Slots:** default radios, `label`, `hint`, `help-text` (Shoelace hint alias), `error`.

**CSS parts:** `base`, `form-control`, `label` / `form-control-label`, `radios` /
`form-control-input` / `button-group` / `button-group__base`, `hint` /
`form-control-help-text`, and `error`.

**The required marker.** `required` with a non-empty group `label` paints the library's shared
marker on the `form-control-label` node — the one `::after` rule described under "The
required-field marker" above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. It marks the **group**, not the individual radios: an owned
`<lr-radio>` has no label box of its own and paints nothing. With no group label text the node is
hidden and no glyph is painted.

**Themeable custom properties:** `--lr-radio-group-row-gap` (default
`calc(var(--lr-form-control-height) * 0.2)`) — the vertical gap between the group's label, its
options and its messages, scaled by `size` through the shared control ladder.

**Methods:** `setCustomValidity(message = '')` sets or clears a group-level consumer error. A
non-empty message raises `customError` and blocks submission; `setCustomValidity('')` and
`resetValidity()` restore the group's computed validity, including `valueMissing` when a required
group has no selected radio. `focus()` moves focus to the selected (or first enabled) radio;
`blur()` releases whichever owned radio currently contains deep focus, and `click()` mirrors
`focus()` by activating the selected/first enabled radio. All three are inert under direct or
fieldset disablement, so the group behaves like one native control.

## `lr-checkbox-group`

Long group labels, hints, errors, and horizontal option labels wrap within the host in both logical
directions. The `Narrow RTL long options (320px)` story is the adversarial baseline; checkbox
targets keep their own fixed hit-area floor while the surrounding text wraps.

A form-associated collection of `<lr-checkbox>` children. Its readonly `value` is a defensive
`string[]` snapshot; each
selected value is submitted under `name` and `required` requires at least one selection.

**Properties:** `label`, `hint`, `errorText`, `value`, `customError` (`custom-error`), `name`,
`required`, `disabled`, `orientation: 'vertical' | 'horizontal' = 'vertical'`,
`withLabel`/`withHint` (`with-label`/`with-hint` SSR presence hints),
`accessibleLabel` (`aria-label`), and `size?: LyraSize` (reflected) — the optional size of the group's
**own** chrome, on the shared ladder and accepting both `2xs`/`xs`/`s`/`m`/`l`/`xl` and
`small`/`medium`/`large`. It scales the group's label type size and the gaps around and between its
options. When set, it temporarily projects the tier to every owned `<lr-checkbox>`, including
children added later. When omitted, each child retains its own authored tier.

An explicit group `size` is owner state, not a destructive rewrite: late child-size writes are
remembered while the group remains authoritative, and removing the group size, moving an option
out, or disconnecting the group restores the latest authored child value. This matches Web
Awesome's unset-default behavior.

**Slots:** default checkboxes, `label`, `hint`, `error`.
**Events:** a user toggle emits exactly one group-owned `input`, then `change`, then `lr-change`;
all three carry `{ value: string[] }`. The owned child's corresponding events are consumed at the
group boundary, so an ancestor does not receive a second, differently shaped sequence.
Programmatic child `checked`/`value` synchronization is silent and completes synchronously, so a
same-task `new FormData(form)` or validity query observes the same state as the child.
`lr-invalid` (no detail) is the group's one bubbling/composed native-validity alias.
**Methods:** `getForm()` returns the group's owning form, including an external owner selected by
`form`. `setCustomValidity(message)` sets or clears a consumer-supplied error ("that
combination of topics is not available"): a non-empty message raises `customError` and blocks
submission, `''` restores the group's own computed validity so a required group with nothing checked
goes back to `valueMissing`. It survives every child toggle, slot change and form reset.
Session restore uses a `FormData` state containing the repeated selected strings; it is independent
of the control's current `name`, preserves duplicate-value cardinality, waits for early-arriving
option children, and falls back to an empty selection for malformed state. Restoration is silent.
`focus()` targets the first enabled checkbox, `blur()` releases whichever owned checkbox contains
focus, and `click()` activates (toggles) the first enabled checkbox. Native validity UI anchors to
that checkbox's focusable semantic owner. A required group also leases a localized visually-hidden
aggregate requiredness description onto its fieldset without replacing hint/error IDs; it does not
incorrectly mark every child checkbox required.
The fieldset exposes explicit stateful `aria-invalid`: visible property/slotted error chrome makes
it `"true"` immediately; otherwise only interacted intrinsic/custom invalidity does so, and the
valid/pristine state is explicitly `"false"`.
**CSS parts:** `form-control`, `form-control-label`, `options` / `form-control-input`, `hint`,
`error`.
**Disabled chrome.** A disabled group — its own `disabled` or an ancestor `<fieldset disabled>` —
dims `form-control-label`, `hint` and `error` to `--lr-opacity-disabled`. The dimming is keyed off
the UA-computed `:disabled` state (so the fieldset cascade reaches it) and is deliberately applied
to those three parts rather than the host: each owned `<lr-checkbox>` already dims itself, and a
host-level opacity would compound with it.
**The required marker.** `required` with a non-empty group `label` paints the library's shared
marker on `[part="form-control-label"]` — here the `<legend>` of the group's fieldset. It is the
one `::after` rule described under "The required-field marker" above, not a copy of it, so
`--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`. It
marks the **group**, not the individual checkboxes: an owned `<lr-checkbox>` has no label box of
its own and paints nothing. With no group label text the legend is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-checkbox-group-row-gap` (default
`calc(var(--lr-form-control-height) * 0.1)`), the vertical gap between the group's label, options
and messages, and `--lr-checkbox-group-option-gap` (default
`calc(var(--lr-form-control-height) * 0.2)`), the gap between adjacent options — both scaled by
`size` through the shared control ladder. WA's `--gap` alias is the value used by the rendered
option layout and defaults to `--lr-checkbox-group-option-gap`.
`--lr-checkbox-group-invalid-border` (default `var(--lr-color-danger)`) independently retints the
invalid option-collection border without changing other danger-colored surfaces.

**`value` reads as a frozen defensive snapshot of child state, and assigning it mirrors back onto
the children.** The children remain the single source of truth. An internal sync recomputes `value`
on every child toggle, programmatic child `checked`/`value`/`disabled` update, `slotchange`,
`name`/`required` change, blur, and `form.reset()`. Mutating an obtained array cannot mutate the
group — assign a new array instead.
Only a checkbox whose nearest `lr-checkbox-group` ancestor is this group contributes; a nested
group owns its own descendants and form entries. `connectedCallback()` runs that sync before the
first render.

Assigning checks every child whose `value` (defaulting to `'on'`) appears in the array and unchecks
every other one; duplicate entries check that many same-valued children, and values naming no child
are ignored. `null`/`undefined` clear the selection. It is controlled input, so it emits no
`lr-change` — only user interaction does. An assignment made before the children exist (the shape of
a `.value=${...}` binding on first render) is applied once they arrive.

- **To preselect**, either set `checked` on the children (`<lr-checkbox value="a" checked>`) or
  assign the group's `value`.
- **To read the selection**, use this property or the `lr-change` event detail.
- **Give every child a distinct `value`.** `<lr-checkbox>`'s `value` defaults to `'on'`, so a group
  of undifferentiated children submits several identical `FormData` entries and the submitted data
  cannot say which one was checked. The group warns once per duplicated value when it sees this.
- Assignments migrate to writes on the intended children's `checked` state; a host value such as
  `['on']` cannot identify which default-valued occurrence was intended.

## `lr-token-input`

An editable form-associated token list. Enter, comma, or blur commits a token; Backspace removes
the last token. `value` is a readonly owned `readonly string[]` snapshot and repeated values are
submitted under `name`; mutate a new array and reassign it to change the list.

**Properties:** live, non-reflecting `value`, reflected `defaultValue` (attribute `value`, encoded
as a JSON string array), `customError` (`custom-error`), `label`, `hint`, `errorText`
(`error-text`), `placeholder`, `name`,
`required`, `disabled`, `accessibleLabel` (attribute `aria-label` — forwarded to the input wrapper
and draft text input; precedence is presence-based, so `aria-label=""` remains an explicit empty
override and suppresses visible-label linkage), `spellcheck: boolean = true`, `autocapitalize: string = ''`, and `autocorrect` (read: `boolean = true`; write: `boolean | string`, attribute values
`on`/`off`) — all three native text-entry hints are forwarded to both the draft input and the inline
token editor. The former camel-case `autoCorrect` property is removed; use the native-shaped
lowercase IDL. `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected —
same scale as `lr-input`'s `size`, scaling the input-wrapper's row height and text size across six
tiers, and both `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large` are accepted; the remove
button's hit area stays fixed at `40px` across all sizes), `pill` (reflected, default `false` —
rounds the token row's corners by changing the private radius default to `--lr-radius-pill`; the
chips share the public `--lr-token-input-radius` hook with the row, and an inherited or direct
value remains authoritative),
`allowDuplicates`
(`allow-duplicates`, default `false`), `editable` (reflected, default `false` — see below), and
`delimiter: string | null` (default `','` — see below).
**Slots:** `label`, `hint`, `error`, `start` (adornment before the tokens), `end` (adornment after
the draft input) — both wrapped in a `hidden`-toggling span, mirroring `lr-combobox`'s identical
`start`/`end`.
**Events:** native `InputEvent` `input`, `lr-input`, native `Event` `change`, then `lr-change` for
each list mutation; native events have no detail and both aliases carry a frozen
`{ value: readonly string[] }` snapshot.
Native `FocusEvent` `focus`/`blur` are relayed once from the draft and inline editor, preserving
`relatedTarget`. `lr-add`
(`detail: { value, values }`, where `value` is the final added token and `values` is the frozen,
readonly, complete ordered and deduplicated set of tokens added by that commit — cancelable as of
10.0.0; `preventDefault()` keeps the tokens out of `value` and leaves the typed draft text in the
input unchanged so the user can correct it, rather than clearing it),
`lr-remove`
(`detail: { value, index }` — cancelable; `preventDefault()` keeps the token in `value`
unchanged), and `lr-token-edit`
(`detail: { value, previousValue, index }` — an existing token is about to be edited in place —
cancelable as of 10.0.0; `preventDefault()` keeps the token in `value` unchanged and leaves the
inline editor open with the user's edited text intact, rather than closing and discarding it).
All three mutators now share one veto contract; previously only `lr-remove` could be vetoed.
`lr-invalid` (no detail) is emitted once as a bubbling/composed alias when native validity fails.
**CSS parts:** `form-control`, `form-control-label`, `input-wrapper`, `token`, `token-label` (the
token's text, doubling as the roving-focus edit trigger — rendered only while `editable`),
`token-editor` (the inline text field that replaces a token's text while it is open for editing —
rendered only while `editable` and only for the token being edited), `remove` (the
per-token remove button, floored at the shared `--lr-icon-button-size` tap size around a compact
glyph), `input`, `start`, `end`, `hint`, `error`. `focus()`, `blur()`, `click()`, and `select()` forward to the
internal draft text input. `selectionStart`, `selectionEnd`, and `selectionDirection` are readable/
writable native-selection passthroughs; `setSelectionRange(start, end, direction?)` and
`setRangeText(replacement, start?, end?, selectMode?)` expose the matching native methods.
`setRangeText()` synchronizes the pending draft without emitting `input`/`change`, so the next
delimiter, Enter, or blur commit consumes the edited text. `getForm()` returns the browser-resolved
owning form. `setCustomValidity(message)` carries a
rejection no client-side constraint can express
("that tag is reserved"): a non-empty message raises `customError` and blocks submission, `''`
restores the control's own computed validity so a `required` control with no tokens goes back to
`valueMissing`. It survives every token add, removal and edit, and a `form.reset()`.

`defaultValue` is the current reset target. A live `value` write marks the token list dirty, so a
later default/attribute mutation does not overwrite it; `form.reset()` restores the latest default
and makes the value pristine again. Session restoration uses repeated entries in a `FormData`
state, is independent of the current `name`, accepts early delivery, rejects malformed/file state
to an empty list, and emits no user events.

**`editable` — editing a token in place.** Off by default, in which case the token row renders
exactly as it does without the feature and stays non-focusable. Turn it on and each token becomes a
roving tab stop (one Tab stop for the whole row): click, Enter, Space, or F2 opens an inline
editor on that token; ArrowLeft/ArrowRight move between tokens (swapped under RTL, since they mean
previous/next _visually_), Home/End jump to the first/last. Inside the editor, Enter commits and
returns focus to the token, Escape cancels (and is consumed rather than left to bubble, so an
enclosing dialog or popover does not also close), and blurring commits _without_ pulling focus
back — a blur means the user already aimed focus elsewhere. A changed inline edit commits and emits
its native/alias input-change sequence before the public native/alias blur sequence. Both the draft
and inline editor relay one native bubbling/composed host `focus` or `blur` event while their source
event stays internal.
`lr-token-edit` fires only for an edit
that actually changed something: a reverted, unchanged, emptied, or (under the default
`allowDuplicates = false`) duplicate-colliding edit is discarded silently, mirroring how a
duplicate draft is skipped rather than rejecting the whole entry. Own or fieldset-cascaded
disablement removes every token label's tabindex, renders `aria-disabled="true"`, retires any
internal focus/editor state, and suppresses enabled hover/active paint. Re-enabling renders
`aria-disabled="false"` and restores exactly one roving token stop.
Host `focus()` and `click()` are also synchronous no-ops under own or fieldset-cascaded disablement,
including the same task that sets `disabled` before Lit has updated the still-rendered native draft.
`blur()` remains available to release existing focus.
When a focused token label, editor, or remove action disappears through its own removal or a
controlled `value`/pristine `defaultValue` shrink, DOM focus moves to the nearest surviving
equivalent surface at the clamped index. If no token remains it moves to the draft input; a newer
explicit focus destination outside the component is never reclaimed.

**`delimiter` is nullable, and only a single character acts as a commit key.** It does two separate
jobs: it splits a committed draft into several tokens, and — _only when it is exactly one
character_ — it is the keystroke that commits the draft. A multi-character delimiter still splits a
pasted or committed draft, but no keystroke can ever match it, so nothing commits on typing.
Setting it to `null` disables both, so a token may contain the delimiter verbatim. **`delimiter="null"`
does not work** — that is the four-character string `null`. Use `delimiter="none"`, `delimiter=""`
(both of which the attribute converter maps to `null`), or a property binding
(`.delimiter=${null}`). Removing the attribute restores the `,` default.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. It marks the control, not an individual token. With no label
text the part is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-token-input-padding` (the input-wrapper padding, scaled by
`size`), `--lr-token-input-font-size` (the input-wrapper and token font size, scaled by `size`),
`--lr-token-input-control-min-height` (the input-wrapper's block-size floor, scaled by `size`),
`--lr-token-input-control-height` (exact input-wrapper height — undeclared by default, leaving the
`--lr-token-input-control-min-height` floor only; set it to a length to both floor and cap the row,
e.g. to pixel-match a sibling field in the same toolbar row). An uncapped row grows as tokens wrap.
A capped row explicitly clips inline overflow and becomes a block-axis scrollport, preserving every
wrapped token and 40px-floored remove/edit action instead of clipping them; keyboard focus scrolls
the destination token into view. `--lr-token-input-input-inline-size`
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
- `--lr-token-input-action-hover-bg` — Backwards-compatible aggregate edit/remove hover
  background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-token-input-edit-hover-bg` / `--lr-token-input-edit-pressed-bg` — Editable token-label
  hover and pressed backgrounds. The hover hook falls back to
  `--lr-token-input-action-hover-bg`; the pressed hook defaults to its active-state mix.
- `--lr-token-input-remove-hover-bg` / `--lr-token-input-remove-pressed-bg` — Remove-action hover
  and pressed backgrounds, with the same aggregate-hover and active-state fallbacks.
- `--lr-token-input-focus-border-color` — Focused row border color. Default: `var(--lr-color-brand)`.
- `--lr-token-input-invalid-border-color` — Invalid row border color. Default: `var(--lr-color-danger)`.

## `lr-code-editor`

Long translated form chrome wraps within the host, while long source stays reachable through the
editor's internal scroll extent instead of widening the page. The `Narrow RTL long content
(320px)` story covers both boundaries together.

Dependency-free, form-associated multiline code editor built around a native textarea, with an
optional line-number gutter. No syntax highlighting: `language` is metadata only.

**Properties:**

- `language: string = ''` — reflected on the host and projected onto the `editor` part as
  `data-language`; purely a consumer-reachable styling/metadata hook, nothing tokenizes the text
- `lineNumbers: boolean = true` (attribute `line-numbers`, reflected) — renders the `gutter` part,
  one row per `\n`-separated line
- `tabSize: number = 2` (attribute `tab-size`) — spaces inserted per Tab press, and the textarea's
  inline `tab-size`. Sanitized on assignment to a finite integer clamped to `1..16`, so a
  `NaN`/`Infinity` value can neither empty the insert nor throw out of `String.repeat()`
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`),
  `placeholder: string = ''`
- `readonly: boolean = false` (reflected) — also disables Tab indentation
- `rows: number = 4`, `cols: number = 20`, `minlength?: number`, `maxlength?: number` — native
  textarea geometry and code-unit length constraints. Programmatic/restored values receive the
  same supplemental length validity as user edits.
- `resize: 'none' | 'both' | 'horizontal' | 'vertical' | 'auto' = 'both'` — written as the
  textarea's inline `resize`; `auto` grows the owned surface to its content without a manual drag
  handle, and an invalid runtime value falls back to `'both'`
- `size: LyraSize = 'm'` (reflected) — visual size on the shared control ladder, the same scale as
  `lr-textarea`/`lr-input`/`lr-select`, accepting both spellings of every tier (`2xs`/`xs`/`s`/`m`/
  `l`/`xl` and `small`/`medium`/`large`). Governs the gutter's and textarea's padding and font size,
  plus the editor frame's minimum block size.
- `wrap: 'off' | 'soft' | 'hard' = 'off'` — native textarea wrapping; `'off'` (the default) makes
  the `editor` part the single horizontal scroll viewport. `hard` uses the owner realm's native
  textarea serializer, so FormData receives platform-equivalent `cols` wrapping while the live
  `value` remains unwrapped.
- `spellcheck: boolean = false` — off by default for code, and parsed with a string-aware converter
  so `spellcheck="false"` really is `false`
- `autofocus: boolean = false`, `title: string = ''`, `autocomplete: string = ''`,
  `inputMode`/`inputmode: string = ''`, `enterKeyHint`/`enterkeyhint: string = ''`,
  `autocapitalize: string = 'off'`, and `autocorrect: boolean = false` (attribute vocabulary
  `on`/`off`; boolean and string writes normalize through the shared native converter)
- `accessibleLabel: string = ''` (attribute `aria-label`) — wins over `label`/the localized
  `codeEditorLabel` fallback on the internal textarea
- The shared form surface adds `value`, `defaultValue`, `customError` (`custom-error`), `name`,
  `disabled`, `required`, `form`, `getForm()`, `checkValidity()`, `reportValidity()`, and
  `setCustomValidity()` / `resetValidity()`. The latter clears only consumer custom validity and
  restores current intrinsic constraints; it does not change the value/default or prior
  interaction state.

**Methods:** `focus(options?)`, `blur()`, `select()`, `setSelectionRange(start, end, direction?)`,
`setRangeText(replacement, start?, end?, selectMode?)` (writes the result back into `value` without
emitting an event), and `scrollPosition()` / `scrollPosition({top?,left?})`. The `input` getter
returns the owned native textarea after render. `selectionStart`, `selectionEnd`, and
`selectionDirection` use native nullable sentinels before that surface exists.
The native textarea receives the actual `required` state. Its `aria-invalid` is true whenever
visible property/slotted error chrome exists, or after interaction while native validity fails;
showing error chrome alone does not mutate `ElementInternals` validity.

**Events:** exactly one realm-correct native `input`, `change`, `focus`, and `blur` is relayed from
the internal textarea; native payload such as `InputEvent.inputType` and
`FocusEvent.relatedTarget` is preserved. Typed `lr-input`/`lr-change` aliases carry
`detail: { value }`. `lr-invalid`
(no detail) fires once when validity fails.

**Slots:** `label`, `hint`, `error`.

**CSS parts:** `form-control`, `label` / `form-control-label` (both tokens sit on the same `<label>`
element — `label` is the historical name, `form-control-label` the one every other form component
in this family uses), `editor` (the bordered frame and the single scroll viewport), `gutter` (line
numbers, `aria-hidden`, only when `lineNumbers`), `textarea`, `hint`, `error`.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
that label element — the one `::after` rule described under "The required-field marker" above, not
a copy of it, so `--lr-form-control-required-content`, `--lr-form-control-required-color` and
`--lr-form-control-required-offset` retune or suppress it here exactly as they do on `lr-input`.
With no label text the element is hidden and no glyph is painted.

**Themeable custom properties:** `--lr-code-editor-min-block-size` (default `--lr-size-8rem`, the
frame's and textarea's height floor), `--lr-code-editor-padding` (default `--lr-space-s`, the
gutter's block-side padding and the textarea's all-side padding), and `--lr-code-editor-font-size`
(default `--lr-font-size-m`, the gutter's and textarea's font size) — all three come from the active
`size` tier by default, and assigning one directly overrides that tier's value. Also
`--lr-code-editor-line-height` (default `1.5`, applied to both gutter and textarea so line numbers
stay aligned with their lines).
`--lr-code-editor-tab-size` (default `2`) is read by the `textarea` part's rule and drives both the
rendered tab stops and the number of spaces Tab inserts. Precedence, highest first: an explicitly
assigned `tabSize` (property or `tab-size` attribute) > a host-level `--lr-code-editor-tab-size` >
the `:host` default of `2`. The component writes the token inline on the `textarea` part only while
`tabSize` has been assigned, so an untouched `tabSize` leaves your override in charge; removing the
`tab-size` attribute hands control back to the token. A length-valued override (`40px`, `2ch`, …)
still sets the visual tab stops for literal tab characters, but is not reinterpreted as a count of
spaces — the Tab key keeps inserting `tabSize` spaces in that case.
`--lr-code-editor-hover-border` (default `var(--lr-color-brand)`) and
`--lr-code-editor-invalid-border` (default `var(--lr-color-danger)`) retint those frame states
without changing brand/danger paint in sibling components.

**Known gotchas:**

- Keyboard contract (no keyboard trap, WCAG 2.1.2): Tab inserts one indent unit of spaces at the
  caret (see the tab-width precedence above);
  Shift+Tab is never captured, so reverse focus traversal always works; pressing Escape releases
  the _next_ Tab for forward traversal instead, and any other keypress (or focus leaving the
  editor) re-arms Tab indentation.
- The host gets a `data-invalid` attribute once the field has been blurred at least once and
  validity fails; the styles hang the danger border off it.
- Public/default/restored CR and CRLF sequences normalize once to LF, matching the native
  textarea's value, gutter line count, selection offsets and ordinary FormData state.

**Additional API surface:** `click()` activates the internal editing surface.

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
- In popup mode the visible control is a `<button>` (`[part="trigger"]`): `focus()` targets it and
  `click()` activates it, toggling the popup. There is no native colour input in the shadow tree to
  reach for. Inline mode has no trigger; `focus()` targets the grid handle and `click()` activates
  the editable value field. In either mode `blur()` blurs whichever internal control is active.

`value` is always serialized in the active `format` (`hex` by default), so reading it back after any
interaction gives a canonical string in exactly one syntax; switching `format`, `opacity` or
`uppercase` **re-serializes the same colour** rather than reinterpreting it. Input is far more
permissive than output: hex (3/4/6/8 digit), `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hsv()`/`hsva()`,
CSS colour names, and any other colour syntax the browser itself parses are all accepted. A value
that is not a colour at all is **kept verbatim** rather than silently replaced, so a consumer's own
sentinel survives a round trip. The public `value` and `defaultValue` both default to the empty
string, matching the mirrored form contract; the uncommitted preview and editable field still begin
at black (`#000000`). A bare `required` picker is therefore value-missing, and `form.reset()` returns
to the declarative value or to empty when none was supplied.

Colour is never the only channel carrying state: the trigger's `aria-describedby` points at a
visually-hidden span spelling the current value out in text, the panel shows it in an editable
field, and the selected palette swatch is marked with `aria-pressed` plus a check mark rather than
a tint alone.

Validation is projected onto both editing owners with an explicit stateful `aria-invalid`. A
required empty picker starts pristine, so the popup trigger and panel value input both expose
`aria-invalid="false"` even though `checkValidity()` is false. Once focus leaves the control, the
resulting `user-invalid` state changes both to `"true"`; `reportValidity()` reveals the same state
without requiring a blur. A valid value or `form.reset()` clears the projection back to `"false"`,
while visible error content makes it `"true"`. Inline mode omits the trigger, but its value input
follows the same pristine/user-invalid contract.

**Not the same control as `lr-swatch-picker`.** This one is freeform: `swatches` is a shortcut row
_beside_ a saturation grid, a hue ramp and a text field, and the committed value can be any colour
the browser parses. `<lr-swatch-picker>` offers exactly its `options` and nothing else, with
`radiogroup` semantics rather than a popover. Reach for it when the answer must be one of N
designer-chosen colours; reach for this when it must not.

**Properties:** the shared
form properties `name`, `value`, `defaultValue` (canonical content attribute `value`),
`customError` (`custom-error`), `disabled`, and
`required`, plus `label`, `hint`, `errorText`
(`error-text`), `accessibleLabel` (`aria-label`), and `size: LyraSize = 'm'`
(reflected — the same visual-density scale as `lr-input`, applied to the centered visible swatch;
accepts `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`; the interactive target
independently retains the `--lr-icon-button-size` floor),
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
  entries are dropped. An entry that is _not_ parseable is kept in the list and still renders a
  swatch — it just paints no colour (the bare checkerboard) and clicking it does nothing, so filter
  the palette yourself if that matters. `label` becomes the swatch's accessible name — without one
  the raw colour string is announced. The palette container renders only while the normalized list
  is non-empty
- `withoutFormatToggle: boolean = false` (attribute `without-format-toggle`) — removes the button
  that cycles between formats. `noFormatToggle` (`no-format-toggle`) is the Shoelace spelling and
  reaches the same behavior; either one wins
- `inline: boolean = false` (reflected) — renders the full panel in normal flow and omits the popup
  trigger. In this mode `focus()` targets the grid handle and `click()` targets the value field.
  The panel stays visible regardless of `open`; `show()`/`hide()` still update that lifecycle state
  and its events so switching back to popup mode has a deterministic result
- `hoist: boolean = false` (reflected) — uses fixed popup positioning to escape clipping
  ancestors; the default absolute strategy stays in the component's local scrolling context
- `withLabel: boolean = false` (`with-label`, reflected) and `withHint: boolean = false`
  (`with-hint`, reflected) — SSR hints that the corresponding slots are populated, so their chrome
  is present before client-side slot observation
- `placement: Placement = 'bottom-start'` (reflected) — preferred panel placement, from the Floating
  UI vocabulary. The resolved side still flips/shifts to stay in the viewport, and the
  `left`/`right` component is swapped under RTL
- `open: boolean = false` (reflected) — whether the popup panel is open. Assigning `true` while the
  control is effectively disabled is ignored, and a `disabled` that flips on while the popup is
  already open closes it. Inline rendering remains visible at either value

**Methods:** `show()` opens the popup (a no-op while effectively disabled), and `hide()` closes it
and returns focus to the trigger. In popup mode `click()` activates the trigger and therefore
toggles the popup, while `focus(options?)` targets that trigger. Inline mode has no trigger:
`click()` activates the editable value field and `focus(options?)` targets the grid handle.
`blur()` blurs the active internal control in either mode; `click()` and `focus()` are inert while
effectively disabled. In inline mode `show()`/`hide()` update `open` and lifecycle events without
hiding the in-flow panel.
`getFormattedValue(format?)` returns the current colour in any of the eight output formats —
`'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsv' | 'hsva'`, defaulting to `'hex'` —
independently of `format`/`opacity`, honouring `uppercase`. Use it to read, say, an `rgba()` string
out of a picker configured to store hex, without touching `value`.
`getHexString(hue, saturation, brightness, alpha = 100)` converts percent-scaled HSV(A) channels
to six-digit hex, or eight-digit hex when alpha is below 100, honoring `uppercase`.
The shared form methods are
`getForm()`, `checkValidity()`, `reportValidity()`, `setCustomValidity(message)`, and
`resetValidity()`. `resetValidity()` clears only consumer-supplied custom validity and recomputes
the current intrinsic constraints; it leaves `value`/`defaultValue` and prior interaction state
unchanged.

**Slots:** `label`, `hint`, `error`. Slotted label text replaces the `label` property's visible text
and names both the trigger and dialog; a host `aria-label` remains the strongest naming override.

**Events:** each serialized value-changing edit emits a bubbling/composed native `InputEvent` named
`input`, followed by the no-detail `lr-input` compatibility alias. A completed interaction emits
one bubbling/composed native `Event` named `change`, followed by `lr-change` with
`detail: { value }`. The commit pair occurs on pointer release, key release, swatch click, an
accepted text-field change/Enter, or an eyedropper result. A drag or repeated key can therefore
emit several `input`/`lr-input` edit pairs but only one `change`/`lr-change` commit pair.
Pointer drags are reversible previews: `pointercancel`, lost pointer capture, mid-gesture
disablement, disconnection, or document adoption restores the pre-gesture colour and submitted
form value without emitting another `input` or a commit pair. A direct consumer `value` assignment
during a drag is authoritative instead: it retires the gesture and remains current.
Also emitted are `lr-show` / `lr-after-show` and `lr-hide` / `lr-after-hide` (the panel opened
or closed — never emitted for a declaratively-open picker's first render, nor for a close caused by
disconnection; because this panel has no opening animation, each `lr-after-*` immediately follows
its matching lifecycle event in the completed update), and `focus`/`blur`
(exactly one bubbling/composed native `FocusEvent` relay when focus
enters or leaves the internal controls in either popup or inline mode), and `lr-invalid`
(no detail) once when native validity fails. A change that
doesn't move the serialized value emits nothing, so dragging within a single rounded colour is
silent.

**Keyboard.** The grid handle, hue handle and opacity handle are each a real `role="slider"` with a
localized name and `aria-valuetext`. Arrow keys step by 1 (percent or degree), Shift+Arrow by 10,
and Home/End jump to that axis' extremes; ArrowLeft/ArrowRight swap meaning under RTL, ArrowUp/Down
never do. One discrete press pairs a keydown (`input`/`lr-input`) with a keyup
(`change`/`lr-change`); OS key repeat re-fires the edit pair but still commits once. The panel is
Escape-dismissible and returns focus to the trigger; a pointerdown outside the element closes it
too. Both routes are topmost-aware through the shared nonmodal overlay stack, so an older color
picker remains open under a newer Lyra popup and receives the manager's focus handoff when that top
layer closes.

**CSS parts:** `base` (permanent compatibility name on the same field wrapper as `color-picker`),
`color-picker` (the field wrapper; it is the same node as `base` and `form-control`),
`form-control` (the field wrapper; it is the same node as `base` and `color-picker`),
`form-control-label` (the label; `label` is its permanent compatibility name), `trigger-container`
(the row wrapping the trigger), `trigger` (the swatch button that
opens the panel), `panel` (the positioned `role="dialog"` surface), `grid` (the
saturation/brightness square) and `grid-handle` (its draggable, keyboard-operable handle),
`slider` and `slider-handle` (carried by **both** ramps), `hue-slider` / `hue-slider-handle` and
`opacity-slider` / `opacity-slider-handle` (each also carrying the shared `slider`/`slider-handle`
token, so `::part(slider)` styles both ramps while `::part(hue-slider)` reaches only one; the
opacity pair renders only with `opacity` set), `preview` (the current-colour dot beside the ramps),
`input` (the text field holding the serialized value), `format-button` (the format-cycling button,
absent with either format-toggle suppression property), plus `format-button__base`,
`format-button__start`/`format-button__prefix`, `format-button__label`,
`format-button__end`/`format-button__suffix`, and `format-button__caret`;
`eyedropper-button` / `eye-dropper-button` (rendered only where the browser exposes the EyeDropper
API), with the corresponding `eyedropper-button__base|start|label|end|caret` and Shoelace
`eye-dropper-button__base|prefix|label|suffix|caret` aliases; `swatches` (the palette container, rendered only when the normalized `swatches`
list is non-empty), `swatch` (one palette entry), `swatch-selected` (a token **added to** the
swatch matching the current value — state after `::part()` never matches, so write
`::part(swatch-selected)`), `hint`, `error`.

The eyedropper aliases are also addressable individually as `eyedropper-button__base`,
`eyedropper-button__start`, `eyedropper-button__label`, `eyedropper-button__end`,
`eyedropper-button__caret`, `eye-dropper-button__base`, `eye-dropper-button__prefix`,
`eye-dropper-button__label`, `eye-dropper-button__suffix`, and `eye-dropper-button__caret`.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. With no label text the part is hidden and no glyph is
painted.

**Themeable custom properties:** `--lr-color-picker-swatch-size` sizes the centered visible swatch,
not the button's minimum target. Its private default follows `size` (default `'m'` reads `2.5rem`,
`'2xs'` reads `1.25rem`, etc.), matching the visual-density ladder `lr-input` uses. The trigger's
inline and block sizes are each
`max(var(--lr-color-picker-swatch-size), var(--lr-icon-button-size))`: compact tiers center a smaller
swatch inside the shared hit-area floor, while a larger swatch expands the target with it. The
panel's geometry has its own public hook set; each hook inherits from an ancestor, and a direct host
value wins:

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

The upstream aliases `--grid-width`, `--grid-height`, `--grid-handle-size`, `--slider-height`, and
`--slider-handle-size` feed the corresponding Lyra geometry properties above; Shoelace's
`--swatch-size` feeds `--lr-color-picker-palette-swatch-size`. An explicit `--lr-*` value takes
precedence over its alias.

Three more are **state, not configuration** — the component rewrites each inline on every render, so
setting them from a stylesheet has no lasting effect: `--lr-color-picker-swatch-color` (the live
colour painted on the trigger, preview, slider handles and palette swatches),
`--lr-color-picker-grid-hue` (the grid's fully-saturated base hue), and
`--lr-color-picker-opacity-gradient` (the opacity ramp's transparent-to-opaque gradient, built from
the current colour and text direction). Read them if you need the resolved colour; don't assign them.

**Additional API surface:**

- `click()` — In popup mode activates the trigger, opening or closing the panel; in inline mode
  activates the editable value field instead. It is a no-op while effectively disabled.
- `--lr-color-picker-gap` — Gap between field chrome and panel rows. Default: `var(--lr-space-xs)`.
- `--lr-color-picker-radius` — Trigger, grid, field and panel corner radius. Default: `var(--lr-radius)`.
- `--lr-color-picker-hover-border-color` — Hover border color, shared by the trigger, handles, text
  field, format/eyedropper buttons and palette swatches. Default: `var(--lr-color-brand)`.
- `--lr-color-picker-selected-border` — Selected palette-swatch border. Default:
  `var(--lr-color-brand)`.
- `--lr-color-picker-selected-check-color` — Checkmark on the selected palette swatch. Default:
  `var(--lr-color-surface)`.

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
  import "@aceshooting/lyra-ui/components/forms/color-picker/color-picker.js";
  const picker = document.querySelector("lr-color-picker");
  // Objects give each entry a real accessible name:
  picker.swatches = [
    { color: "#e11d48", label: "Rose" },
    { color: "#2563eb", label: "Blue" },
  ];
  picker.addEventListener("change", () => {
    console.log(picker.value); // e.g. "RGBA(225, 29, 72, 1.00)"
    console.log(picker.getFormattedValue("hexa")); // e.g. "#E11D48FF"
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

Public `--lr-emoji-picker-*` theme inputs stay undeclared on the host, so an ancestor theme wrapper
can override size-tier fallbacks; a value set directly on the element still wins.

**Properties:** the shared form properties `name`, `value`, `defaultValue`, `customError`
(`custom-error`), `disabled`, and `required`, plus
`groups: readonly EmojiPickerGroup[] = []` (attribute: false) — readonly `EmojiPickerGroup { key,
label, emojis: readonly EmojiPickerItem[] }`, readonly `EmojiPickerItem { emoji, name,
shortcodes? }`; assignment captures a bounded frozen owned snapshot. The search field matches
`name` and every `shortcodes` entry, case-insensitively. Consumer group labels render verbatim.
Groups returned by the built-in loader carry private provenance, letting their fixed emojibase
headings follow `registerLyraLocale()`/`.strings` without exposing localization keys as consumer
data. Empty (the default, before the auto-loader
resolves) renders just the search input and the empty state. `accessibleLabel` (`aria-label`)
forwards a host-supplied accessible name to the internal `role="listbox"` grid; empty falls back to
the localized default grid label. `label: string = ''` — visible label rendered above the
search/grid; unset renders no label chrome. When `label` (or the `label` slot) is set and
`accessibleLabel`/a host `aria-label` is not, the grid's accessible name switches from the
localized default to `aria-labelledby` pointing at the visible label. `hint: string = ''` —
supporting text rendered below the search/grid; unset renders no hint chrome. `errorText: string =
''` (attribute `error-text`) — validation-error text rendered below the hint (overridden by slotted
`error` content when provided); unset renders no error chrome. `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` —
visual size; scales the glyph and preferred emoji box while every interactive option remains
floored at the shared `--lr-icon-button-size`.

**Methods:** `focus(options?)`, `blur()`, and `click()` delegate to the search input/current owned
focus target, plus `getForm()`, `checkValidity()`, `reportValidity()`, `setCustomValidity(message)`, and
`resetValidity()` provide the shared form-validation surface. `resetValidity()` clears only
consumer-supplied custom validity and recomputes current intrinsic constraints; it does not change
`value`/`defaultValue`, clear prior interaction state, or force a required-empty picker valid.

**Events:** a pick emits native `InputEvent` `input`, `lr-input`, native `Event` `change`, then
`lr-change`; both aliases carry `detail: { value }`. The internal search input's `focus` and `blur`
are relayed once as native `FocusEvent`s preserving `relatedTarget`.
All four native events use the picker's current owner-document realm, including
after adoption. `lr-invalid` (no detail) is emitted once as a cancelable alias when native validity
fails; preventing it also prevents the native `invalid` event that produced it. Programmatic `value`
changes are silent.

**Keyboard:** the grid is a roving-tabindex listbox (a single Tab stop — only the active emoji is
tabbable). ArrowLeft/ArrowRight step the active item backward/forward following reading direction
(swapped under RTL), ArrowUp/ArrowDown move by one visual row (measured from the live wrap layout),
Home/End jump to the first/last item, and Enter/Space picks the active item. The search input is a
`role="combobox"` over the same listbox: the arrow keys and Enter also work while focus stays in
the input, with `aria-activedescendant` tracking the active option. Hovering an emoji with the
pointer also moves the active item to it. When a controlled `groups` replacement removes the
focused option, focus moves to the nearest surviving option; when the same item object remains,
its identity wins even if it moved. A replacement never pulls focus away from the search field or
an external control. In a windowed grid, roving navigation materializes an off-window target before
transferring focus, so End and long row jumps never strand focus on a removed virtual row.

**Slots:** `label` (custom label content), `hint` (custom hint content), `error` (custom error
content, overrides the `errorText` attribute when provided).

**CSS parts:** `form-control` (the outer wrapper around label, `base`, error and hint),
`form-control-label` (the visible label), `base`, `search` (`role="combobox"`), `grid`
(`role="listbox"`, the scroll viewport), `group-label`, `emoji` (each emoji's own `role="option"`
button), `empty` (shown when the search matches nothing, or when a consumer deliberately opted out
with `groups = []`), `load-error` (the failure surface shown in `empty`'s place when the optional
peer failed to load), `hint` (the hint message), `error` (the
error message). The grid scrolls in the block axis and explicitly clips inline overflow, so an
allocation narrower than one option does not introduce a second scrollbar. While windowing is
active the rows are wrapped in `virtual-spacer`
(full-height scroll spacer), `virtual-row` (one absolutely-positioned row), `virtual-label` (an
`aria-hidden` spacer standing in for a row's missing `group-label`), and `virtual-items` (the row's
emoji flex line).

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. With no label text the part is hidden and no glyph is
painted.

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

Emoji interaction states are separate: `--lr-emoji-picker-hover-bg`,
`--lr-emoji-picker-keyboard-active-bg`, `--lr-emoji-picker-selected-bg`/
`--lr-emoji-picker-selected-color`, and `--lr-emoji-picker-pressed-bg`, with matching
`--lr-emoji-picker-keyboard-active-outline-color`,
`--lr-emoji-picker-selected-outline-color`, and
`--lr-emoji-picker-pressed-outline-color` hooks for active, selected, and pressed. The legacy
`--lr-emoji-picker-active-bg` remains the fallback for hover and keyboard-active. These are inline
`var()` fallbacks rather than host declarations, so values set on any ancestor remain effective.
The committed form `value` alone drives `aria-selected`; roving focus and pointer navigation use
`data-active`, so moving through the grid never falsely changes selection. Forced-colors mode also
distinguishes hover (dashed), active (dotted), selected (solid), and pressed (double) outlines.

Two constraints remain. `--lr-emoji-picker-item-size` is held at the shared
`--lr-icon-button-size` minimum: smaller `size` tier values can still shrink the glyph, but never
the interactive option, and the windowed geometry follows the clamped, painted size. And windowed
rows are absolutely positioned at the row-height
pitch, so `--lr-emoji-picker-row-height` must stay at or above the item size plus the group-label
band (`--lr-space-l`) — the default's own formula — or consecutive rows overlap. Columns per
windowed row are additionally capped at 20 regardless of available width.

**Optional peer dependency:** install `emoji-picker-element-data` with
`pnpm add emoji-picker-element-data` for the built-in auto-loaded default emoji set — omit it and
supply `groups` directly instead. The loader never throws; a missing or failed peer logs one
`console.warn` and leaves `groups` empty, and the picker then **fails closed and visibly**: the
grid renders a distinct localized `[part="load-error"]` surface instead of the ordinary
`[part="empty"]` message, so a skipped install is distinguishable at a glance from a genuine
zero-match search or a deliberate `groups = []` opt-out, and announces the same message once
through the document's shared assertive live region (not a shadow-root `role="alert"`, which
announces unreliably). Assigning `groups` afterwards clears it. The adapter buckets the peer's flat
entry list by numeric group id and returns only the public `{ key, label, emojis }` shape. The picker
privately maps auto-loaded group ids 0–9 to the existing `emojiPickerGroup*` locale strings; override
those through `registerLyraLocale()` or `.strings`. An unknown future group id uses `Group {id}`.

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
renders `<lr-textarea>`. The `base` part is an accessible `role="group"`: aggregate label, hint,
and error chrome is linked to that same-shadow role. A host `aria-label` wins by attribute presence
(including an explicitly empty value), while each key retains its field-level name.
Both score branches format visible numeric labels with the effective locale (including non-Latin
digits); segmented item values and submitted rubric values remain stable raw numbers/strings.

**Properties:** `keys: readonly RubricKey[] = []` (attribute: false), where the exported immutable
discriminated union is `ScoreRubricKey | CategoryRubricKey | CommentRubricKey`. Keys use nonblank
first-wins identity and retained valid spelling is not rewritten. Shared fields are
`key`, `label?`, `description?`, and `required?`; only scores expose `min?`/`max?`/`step?`, only
categories expose readonly `RubricKeyOption[]` plus `multiple?`, and only comments expose
`placeholder?`. Runtime schema normalization retains the first occurrence of each nonempty key and
rejects malformed rows. `value: RubricValue = {}` is a defensive readonly snapshot and
`defaultValue: RubricValue = {}` is its explicit form-reset baseline (both attribute: false).
`itemId: string = ''`
(attribute `item-id`, reflected), `hasNext: boolean = false` (attribute `has-next`), `skippable:
boolean = false`, aggregate `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute
`error-text`), SSR presence hints `withLabel: boolean = false` / `withHint: boolean = false`
(attributes `with-label` / `with-hint`), and the shared form properties `name` and `disabled`.
`errors: Readonly<Record<string, string>>` is a frozen effective validation-message snapshot:
intrinsic messages use their rubric key and a consumer-owned whole-form rejection uses `base`.
`customError: string | null` reflects through `custom-error` for that rejection.

Every value path — direct writes, child edits, schema changes, state restoration, reset, events,
rendering, validity, and FormData — uses one canonical object. Finite scores clamp and snap to the
current range/step; nonfinite scores are absent; categories retain only current option values (and
their available occurrence counts); comments must be strings; undeclared keys are dropped. This
prevents a rendered value, public readout, validity result, and submitted JSON from disagreeing.
`form.reset()` restores a fresh clone of `defaultValue`, clears touched/error-reveal state, and
preserves any consumer `setCustomValidity()` message. Changing `defaultValue` updates a pristine
live value but never overwrites a dirty edit.

**Slots:** `label` — aggregate rubric label before the fields; `hint` — aggregate supporting text;
`error` — aggregate validation content; `actions` —
extra host controls rendered in the footer beside Submit/Skip.

**Events:** `lr-input` (`detail: { value }`), `lr-validity-change` (frozen
`detail: { valid, errors }`, deduplicated on effective native validity including consumer custom
errors and own/fieldset validation barring), `lr-submit` (`detail: { value, itemId }`), and `lr-skip`
(`detail: { itemId }`, `skippable` only). `lr-invalid` (no detail) is the one bubbling/composed,
cancelable alias emitted when the complete rubric fails a native validity check; preventing it also
suppresses the native event's default validation UI.

**Methods:** `getForm()` returns the owning form. `setCustomValidity(message)` sets or clears a
form-level error no per-key rule can
express ("this item was already annotated by someone else"): a non-empty message raises
`customError` and blocks submission, `''` restores the rubric's own computed validity — unanswered
required keys, and any key with an unsupported `type`, still hold it invalid. It is whole-control
state exposed as `errors.base`, rather than being attributed to one rubric key. It survives every
`value`/`keys` write and a form reset. When
`errorText` is empty, the current custom-validity message is rendered in the aggregate error region;
clearing it hides that region unless the `error` slot supplies other content.
`click()` forwards to the active field (the same one a submit-and-next transition auto-focuses),
so the host behaves like a single control under both a `<label>`-driven and a programmatic click.

**CSS parts:** `base` (the outer `role="group"` wrapper), `form-control` (aggregate chrome wrapper),
`aggregate-label` / `form-control-label`, `fields` / `form-control-input`, `aggregate-hint` /
`form-control-help-text`, `aggregate-error` / `form-control-error`, `field` (one key's wrapper),
`label`, `description`, `scale` (the
rendered score/category/comment control's wrapper), `error` (a field-level validation message),
`footer`, `submit`, `skip` (only rendered when `skippable`), `empty` (shown when `keys` has no
entries), and `unsupported` (the fallback note for a key whose `type` is outside the three supported
ones).

Field-level `error` content is ordinary visible validation text, not a shadow live region. Score
controls compose the current message into the semantic control's accessible name; category/comment
controls use their own same-shadow label/error plumbing. `reportValidity()` therefore reveals and
focuses the error once without an additional `role="alert"` announcement.

**The required marker.** Required score and unsupported fields own their visible label, so the
shared marker is rendered there. Required category and comment fields retain the marker from their
own `lr-select`/`lr-checkbox-group` or `lr-textarea` label instead; the rubric never adds a second
glyph. `--lr-form-control-required-content` (a quoted CSS `content` string; `''` suppresses it),
`--lr-form-control-required-color` (default `var(--lr-color-danger)`), and
`--lr-form-control-required-offset` (default `0`) retune the same marker across every required
field.

**Themeable custom properties:** Submit rest uses `--lr-rubric-form-submit-bg`,
`--lr-rubric-form-submit-border-color`, and `--lr-rubric-form-submit-color`; its hover and pressed
paint use `--lr-rubric-form-submit-hover-bg`, `--lr-rubric-form-submit-hover-border-color`,
`--lr-rubric-form-submit-active-bg`, and `--lr-rubric-form-submit-active-border-color`. Skip rest uses
`--lr-rubric-form-skip-bg`, `--lr-rubric-form-skip-border-color`, and
`--lr-rubric-form-skip-color`, with `--lr-rubric-form-skip-hover-bg` and
`--lr-rubric-form-skip-active-bg` for its pointer states. All preserve the existing shared-token
and color-mix treatments as fallbacks. Disabled actions still dim through `--lr-opacity-disabled`,
the same library-wide token every other disabled control reads.

## `lr-locale-picker`

A closed-list locale switcher over the library's own locale registry. First-party invention (no
Web Awesome equivalent). With `locales` unset (the default), the offered rows are exactly
`getRegisteredLyraLocales()` — every locale with strings registered via `registerLyraLocale()`,
plus `en` — kept live via `subscribeLyraLocaleRegistry()`. Built directly on `lr-select`'s
trigger-button/`aria-activedescendant` listbox technique, not composed from it — a plain closed
list, no filter/free-text mode.

Public `--lr-locale-picker-*` theme inputs stay undeclared on the host, so an ancestor theme
wrapper can override size-tier fallbacks; a value set directly on the element still wins.

**Properties:**

- `locales?: LyraLocaleCatalog` (attribute: false) — `LyraLocaleCatalog = readonly string[] |
readonly LyraLocaleEntry[]`, `LyraLocaleEntry { tag: string; label?: string; country?: string }`.
  `undefined` (the default) auto-discovers the registry; every supplied array (either form),
  including an authoritative `[]`, overrides it entirely — a curated subset, custom order,
  custom labels, or a locale offered before its strings are registered. Explicit catalogs are
  capped, cloned and frozen at assignment; mutate a new array/entry and reassign it to update the
  list. `country` (ISO 3166-1 alpha-2) overrides a row's derived flag — e.g.
  showing Lebanon's flag for an `'ar'` row instead of the library's default Saudi Arabia mapping;
  only available on the `{tag,label,country}` object form, not the bare `string[]` form. Replacing
  the catalog while the listbox is open keeps keyboard navigation valid: an active row beyond the
  new end is rehomed to the last remaining row. Arrow/Home/End/typeahead changes scroll the active
  owned option into nearest view after render; replacement and disconnect cancel stale scrolls.
- `showFlags: boolean = true` — each row's leading `<lr-flag language={tag} variant="compact">`
  (or `<lr-flag country={country} variant="compact">` when the entry sets `country`); `false`
  omits the flag element entirely (not just visually).
- `value: string = ''` — the **committed** selection (form value, drives `lr-change`). While `''`
  and untouched, the trigger _displays_ `effectiveLocale` as a preview label, but
  `checkValidity()`/`required` are governed by the real `value`, which stays `''` until a real
  commit — mirrors a native `<select>` showing its first option's text without that being a
  committed selection.
- `defaultValue: string = ''` (attribute `value`, reflected) — the current reset default. Live
  `value` writes are non-reflecting and dirty; later default/attribute changes cannot overwrite
  them until `form.reset()` restores the current default.
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message.
- `required: boolean = false`, `disabled: boolean = false`, `name: string = ''` — standard
  form-associated properties.
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`) —
  same opt-in form-control chrome as `lr-select` (props + matching named slots + parts); unset
  renders none of it.
- `open: boolean = false` (reflected).
- `size: LyraSize = 'm'` (reflected) — the same full scale as `lr-select`, accepting
  `2xs`/`xs`/`s`/`m`/`l`/`xl` and `small`/`medium`/`large`.

**Events:** `lr-change` (`detail: { value, previousValue, direction }`, **cancelable**) — fired on
every explicit pick; if not `defaultPrevented`, the component applies the pick itself via
`setLyraLocale(value)`. A listener calling `event.preventDefault()` leaves `value` updated but the
active locale untouched, so a host can persist the choice first and apply it later. `focus`/`blur`
are relayed once from the trigger as native `FocusEvent`s preserving `relatedTarget`.
`lr-invalid` is the single
bubbling/composed, cancelable alias of a failed native validity check.

`direction` (`'ltr' | 'rtl'`, typed as `LyraLocaleDirection`) is the picked locale's writing
direction, resolved through `getLyraLocaleDirection(value)` — a catalog's declared
`registerLyraLocale(tag, strings, { dir })` first, then `Intl.Locale`'s text-info surface where the
engine has it, then `'ltr'`. It is present on every `lr-change`, cancelled or not, and it is carried
precisely so applying the direction is a one-liner instead of an application-maintained table of RTL
tags:

```js
picker.addEventListener("lr-change", (e) => {
  document.documentElement.lang = e.detail.value;
  document.documentElement.dir = e.detail.direction;
});
```

The component still never writes `lang`/`dir` itself — a picker does not own the page — but it no
longer leaves the host to work the direction out. `getLyraLocaleDirection()` is exported from
`@aceshooting/lyra-ui/localization.js` for the same lookup outside an event handler (a persisted
choice applied on boot).

**Methods:** `focus(options?)`, `blur()`, and `click()` — all forward to the internal trigger
button and synchronously no-op under direct or fieldset disablement, same convention as
`lr-select`'s identical trio. `setCustomValidity(message)` sets or clears
a consumer-supplied error ("that locale is not enabled for your account"): a non-empty message
raises `customError` and blocks submission, `''` restores the picker's own computed validity so a
required picker with nothing committed goes back to `valueMissing`. It survives every
`value`/`required` change and a form reset. `getForm()` returns the browser-resolved owning form.

**Slots:** `label`, `hint`, `error`.

**CSS parts:** `form-control`, `form-control-label`, `trigger`,
`trigger-flag` (the trigger's leading `<lr-flag>` for the current value, present only while
`showFlags` is on), `listbox`, `option`, `option-flag` (present only while `showFlags` is on),
`option-label`, `option-tag` (the row's secondary line — the raw BCP-47 tag), `expand-icon`,
`hint`, `error`.

**The required marker.** `required` with a non-empty `label` paints the library's shared marker on
`[part="form-control-label"]` — the one `::after` rule described under "The required-field marker"
above, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. The part is rendered only when there is label text, so an
unlabelled picker paints no stray glyph.

**Themeable custom properties:** `--lr-locale-picker-trigger-padding`,
`--lr-locale-picker-trigger-min-height`, `--lr-locale-picker-trigger-height` (unset by default, a
floor-only escape hatch — set a length to both floor and cap the trigger),
`--lr-locale-picker-font-size`, `--lr-locale-picker-expand-size` (all scaled by `size`), and
`--lr-locale-picker-trigger-hover-bg`, `--lr-locale-picker-open-border-color`,
`--lr-locale-picker-option-active-bg`, `--lr-locale-picker-option-selected-border-color`,
`--lr-locale-picker-option-selected-color`, and
`--lr-locale-picker-option-selected-font-weight`. The state hooks fall back to the previous brand,
quiet-brand, and semibold semantic tokens.

**Optional peer deps:** none directly — each row's `<lr-flag>` degrades to an empty render (no
peer warning duplication; `lr-flag` itself already logs one) when the optional
`@aceshooting/lyra-flags` package isn't installed and `showFlags` is left on.

```html
<lr-locale-picker label="Language"></lr-locale-picker>
<script type="module">
  import { registerLyraLocale } from "@aceshooting/lyra-ui/localization.js";
  registerLyraLocale("fr", { close: "Fermer" });
  document
    .querySelector("lr-locale-picker")
    .addEventListener("lr-change", (e) => console.log(e.detail.value));
</script>
```

**Known gotchas:**

- selecting a row applies `setLyraLocale()` itself unless the listener calls
  `event.preventDefault()` on `lr-change` — it does not touch
  `document.documentElement.lang`/`dir`. Applying those is still the host's job, but the direction
  is no longer the host's to _derive_: read `event.detail.direction` (or call
  `getLyraLocaleDirection(tag)`), rather than keeping a hand-maintained list of RTL tags.
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

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-forms-color-picker-color-core-contracts`** — Supporting data types and helpers for this component family.
  `LyraColorHsva {
  h: unknown;
  s: unknown;
  v: unknown;
  a: unknown;
}`

- **`components-forms-color-picker-color-picker-contracts`** — Supporting data types and helpers for this component family.
  `LyraColorPickerSwatch {
  color: unknown;
  label: unknown;
}`

- **`components-forms-combobox-combobox-contracts`** — Supporting data types and helpers for this component family.
  `ComboboxFilterDetail {
  value: unknown;
}`
  `ComboboxSourceResult {
  rows: unknown;
  total: unknown;
}`
  `ComboboxSourceRow {
  value: unknown;
  label: unknown;
  sub: unknown;
  icon: unknown;
  start: unknown;
  end: unknown;
  badge: unknown;
  accessibleLabel: unknown;
  data: unknown;
  dotColor: unknown;
  group: unknown;
  disabled: unknown;
}`
  `LyraComboboxObjectValidator {
  observedAttributes: unknown;
  checkValidity: unknown;
  input: unknown;
  message: unknown;
}`
  `LyraComboboxObjectValidatorResult {
  message: unknown;
  isValid: unknown;
  invalidKeys: unknown;
}`

- **`components-forms-date-picker-date-input-contracts`** — Supporting data types and helpers for this component family.
  `LyraDateInputObjectValidator {
  observedAttributes: unknown;
  checkValidity: unknown;
  input: unknown;
  message: unknown;
}`
  `LyraDateInputObjectValidatorResult {
  message: unknown;
  isValid: unknown;
  invalidKeys: unknown;
}`

- **`components-forms-date-picker-date-picker-contracts`** — Supporting data types and helpers for this component family.
  `DateRange {
  from: unknown;
  to: unknown;
}`
  `LyraDateRangePreset {
  label: unknown;
  start: unknown;
  end: unknown;
}`

- **`components-forms-emoji-picker-emoji-types-contracts`** — Supporting data types and helpers for this component family.
  `EmojiPickerGroup {
  key: unknown;
  label: unknown;
  emojis: unknown;
}`
  `EmojiPickerItem {
  emoji: unknown;
  name: unknown;
  shortcodes: unknown;
}`

- **`components-forms-form-validator-contracts`** — Supporting data types and helpers for this component family.
  `LyraFormValidator {
  observedAttributes: unknown;
  checkValidity: unknown;
  element: unknown;
  message: unknown;
}`
  `LyraFormValidatorResult {
  isValid: unknown;
  message: unknown;
  invalidKeys: unknown;
}`

- **`components-forms-locale-picker-locale-picker-contracts`** — Supporting data types and helpers for this component family.
  `LyraLocaleChangeDetail {
  value: unknown;
  previousValue: unknown;
  direction: unknown;
}`
  `LyraLocaleEntry {
  tag: unknown;
  label: unknown;
  country: unknown;
}`

- **`components-forms-phone-input-phone-input-contracts`** — Supporting data types and helpers for this component family.
  `LibphonenumberModuleLike {
  getCountries: unknown;
  getCountryCallingCode: unknown;
  country: unknown;
  parsePhoneNumberFromString: unknown;
  input: unknown;
  defaultCountry: unknown;
  validatePhoneNumberLength: unknown;
}`
  `loadLibphonenumberAdapter(/* public names: loader */): unknown`
  `LyraPhoneCountry {
  code: unknown;
  callingCode: unknown;
  label: unknown;
}`
  `LyraPhoneInputEventDetail {
  value: unknown;
  inputValue: unknown;
  country: unknown;
  valid: unknown;
  status: unknown;
}`
  `LyraPhoneNumberAdapter {
  countries: unknown;
  parse: unknown;
  input: unknown;
  country: unknown;
}`

- **`components-forms-rubric-form-rubric-form-contracts`** — Supporting data types and helpers for this component family.
  `CategoryRubricKey {
  type: unknown;
  options: unknown;
  multiple: unknown;
  key: unknown;
  label: unknown;
  description: unknown;
  required: unknown;
}`
  `CommentRubricKey {
  type: unknown;
  placeholder: unknown;
  key: unknown;
  label: unknown;
  description: unknown;
  required: unknown;
}`
  `RubricKeyOption {
  value: unknown;
  label: unknown;
  description: unknown;
}`
  `ScoreRubricKey {
  type: unknown;
  min: unknown;
  max: unknown;
  step: unknown;
  key: unknown;
  label: unknown;
  description: unknown;
  required: unknown;
}`

- **`components-forms-slider-slider-contracts`** — Supporting data types and helpers for this component family.
  `LyraSliderChangeDetail {
  value: unknown;
  minValue: unknown;
  maxValue: unknown;
  handle: unknown;
}`

- **`components-forms-swatch-picker-swatch-picker-contracts`** — Supporting data types and helpers for this component family.
  `SwatchPickerItem {
  value: unknown;
  color: unknown;
  label: unknown;
  icon: unknown;
  gemstone: unknown;
}`

- **`components-forms-textarea-textarea-contracts`** — Supporting data types and helpers for this component family.
  `TextareaScrollPosition {
  top: unknown;
  left: unknown;
}`

- **`components-forms-time-range-time-range-contracts`** — Supporting data types and helpers for this component family.
  `TimeRangePreset {
  label: unknown;
  start: unknown;
  end: unknown;
}`
