# Form-control completeness and native passthrough — lyra-ui agent reference

> Detail behind the "Form-control completeness and native passthrough" digest in
> [AGENTS.md](../../AGENTS.md).

Cross-cutting guarantees, verified across every component that structurally has the surface in
question — not every item applies to every component, but a gap in an applicable one is a bug, not
a missing feature.

- **Label/hint/error chrome.** Any form-associated control (the `FormAssociated` mixin, or a
  hand-rolled `ElementInternals` attachment like `lr-select`/`lr-combobox`) ships
  `label`/`hint`/`errorText` props, matching `label`/`hint`/`error` named slots, and
  `form-control`/`form-control-label`/`hint`/`error` CSS parts — mirroring `lr-select`'s template
  structure (required-asterisk `::after`; `hasLabelSlot`/`hasHintSlot`/`hasErrorSlot` tracked in
  JS, since `[part]:empty` never matches a slot-containing part; `aria-describedby` wired to the
  rendered hint/error ids). The one exception is a control whose own doc comment explicitly
  states it's a deliberately bare primitive with no chrome, or whose interaction idiom is
  genuinely incompatible with a generic label/hint/error frame (e.g. a slider's `label` is an
  accessible-name override, not visible text; a chat composer is a composite input, not a labeled
  field) — silence isn't an exception on its own; a component relying on this carve-out states it
  explicitly in its class doc comment the next time it's touched.
- **ARIA-name forwarding.** Any component that computes its own internal accessible name lets a
  host-level `aria-label` win over that computed default. Two established patterns, by the
  component's own label sources: an `accessibleLabel` property
  (`@property({ attribute: 'aria-label' })`, `lr-date-input`'s pattern) when there are other
  label sources (a `label` prop, a placeholder) to arbitrate against in a specific precedence
  order; a plain `this.getAttribute('aria-label')` fallback (`lr-slider`'s pattern) when there's
  nothing else to arbitrate against.
- **Resize forwarding.** Any component wrapping a native resizable text-editing surface exposes
  the same resize vocabulary the native element supports, including auto-grow-to-content — or its
  doc comment explicitly states the omission (e.g. a fixed-size-by-design surface).
- **Editing-assistance and event-bridging passthrough.** Any component with an internal native
  `<input>`/`<textarea>` forwards `spellcheck`/`autocapitalize`/`autocorrect`/`wrap` (whichever
  apply to that input's `type`), and re-dispatches the internal element's `blur`/`focus` as
  bubbling, composed events via `this.emit('blur')`/`this.emit('focus')` — native `blur`/`focus`
  neither bubble nor cross a shadow boundary, so a host-level listener never sees them otherwise.
- **Disabled visual state uses `:host(:disabled)`, never `:host([disabled])`.** `:disabled` is
  the native FACE pseudo-class the UA sets from *both* the component's own `disabled` and
  fieldset-cascaded disablement — i.e. it tracks `effectiveDisabled`; `[disabled]` only ever
  matches the component's own attribute. A component that computes `effectiveDisabled` in JS but
  styles `:host([disabled])` goes functionally inert inside a `<fieldset disabled>` while still
  rendering at full opacity with a normal cursor — reads as "this control is broken". Grep your
  `*.styles.ts` for `\[disabled\]` before shipping. `lr-checkbox`/`lr-switch`/`lr-select` are
  correct; several others are not.
- **`click()` forwarding.** Any component rendering its own clickable control in shadow DOM — in
  practice, anything already overriding `focus()`/`blur()` — also overrides host `click()` to
  forward to that internal control, as `lr-button` does. `HTMLElement.prototype.click()` on a
  custom element with no native click semantics is a silent no-op, so a form helper or automation
  script calling `.click()` on the host (rather than clicking pixels) does nothing at all.
- **`disabled` gates every self-rendered sub-control, not just the primary one.** Every
  interactive element the component renders itself — a nested textarea, a submit/remove/nav
  button inside a conditionally-rendered panel — binds `?disabled=${this.disabled}` (or
  `effectiveDisabled`). It's easy to wire the main control and forget a secondary one added to
  the same render tree later, leaving the component reading as disabled while a nested action
  stays fully clickable.
- **A `type="submit"|"reset"` control needs real form wiring, not just the attribute.** A
  shadow-internal `<button type="submit">` does not reach an ancestor `<form>` on its own. Any
  component exposing a submit/reset-capable `type` adds `static formAssociated = true`,
  `attachInternals()`, and explicit `closest('form')?.requestSubmit()`/`.reset()` handling,
  matching `lr-button`. Exposing the property without the wiring gives consumers an attribute
  that silently does nothing.
