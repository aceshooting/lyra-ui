# Forms and accessibility

## Form association

`FormAssociated(Base)` (`@aceshooting/lyra-ui/utilities/form-associated.js`) makes a `LitElement`
form-associated: `static formAssociated = true` plus a descriptor-safe `attachInternals` lookup in
the constructor, which eagerly calls
`internals.setFormValue('')` so an untouched control is present in `FormData` as `""` from
construction — matching native `<input>` — instead of being absent.

It adds `name: string`, a non-reflecting live `value: string`, reflected
`defaultValue: string` (attribute `value`), `customError: string | null` (attribute
`custom-error`), `disabled: boolean` (reflected), and `required: boolean` (reflected). These use
hand-written accessors declared with Lit's `noAccessor`, so attribute writes and `internals` calls
happen synchronously rather than waiting for Lit's update cycle.

Mapped controls accept `null` as a setter-only clearing input without changing their getter types:
`.name = null` removes the name and reads back as `''`. The controls that publish a mapped nullable
`value` setter are listed in each control's component reference; ordinary string values clear to `''`, while checkbox
and switch values restore the native `'on'` default and remove their `value` attribute. An explicit
non-null `'on'` reflects `value="on"`. This is a property-assignment spelling only — never write
`name="null"` or `value="null"` in markup.

Every form-associated control exposes element-valued reads from `form` and `getForm()`, plus
`labels`, `validity`, `validationMessage`, `willValidate`, and `effectiveDisabled`. The `form`
setter accepts an owner id, an identified `HTMLFormElement`, or `null`; it reflects/removes the
host's `form` attribute while subsequent reads still return the browser-resolved form element.
Methods include `checkValidity()`, `reportValidity()`, and `setCustomValidity()`.

Native external labels work across the shadow boundary for every form-associated Lyra control:

```html
<label for="display-name">Display name</label>
<lr-input id="display-name" name="displayName"></lr-input>
```

The label text names the internal role owner, and clicking the label focuses text/select-like
controls or activates toggle/button-like controls exactly once. The relationship stays live when
labels are inserted, removed, retargeted, or edited. A host `aria-label` always wins. Compound
controls such as `lr-tool-param-form`, `lr-rubric-form`, and `lr-time-range` put that aggregate name
on an internal `role="group"` while retaining the more specific names of their fields/handles.
Disabled controls, including controls disabled by an ancestor `<fieldset disabled>`, ignore label
activation.

- **Read `effectiveDisabled`, not `disabled`, for the merged state.** `effectiveDisabled` is own
  `disabled` OR an ancestor `<fieldset disabled>`'s cascaded state.
  `formDisabledCallback(fieldsetDisabled)` stores the ancestor state privately, so `disabled` always
  reflects only the consumer's own attribute/property, as native `<input>` does.
- **Validity is real.** `updateValidity()` calls `internals.setValidity({ valueMissing: true }, …)`
  whenever `required` is set and `value === ''`, re-run on every `value`/`required` change and once
  from `connectedCallback()` — so `checkValidity()`/`reportValidity()`/`:invalid`/`:user-invalid`
  reflect actual constraint state.
- **`setCustomValidity(message: string): void`** — the consumer channel for an error no client-side
  constraint can express: a server-side rejection ("that email is already registered"), a
  cross-field rule, a business constraint. A non-empty `message` raises `customError` and becomes
  `validationMessage`, so the control fails `checkValidity()`, blocks submission, and matches
  `:invalid`; `''` clears it. Every value-carrying form-associated control in the library exposes
  it, mixin-based or not.
  ```ts
  const email = document.querySelector("lr-input")!;
  email.setCustomValidity("That address is already registered.");
  form.requestSubmit(); // blocked; the browser reveals this message
  email.setCustomValidity(""); // cleared
  ```
  The method, reflected `customError` property, and `custom-error` attribute are one atomic state:
  a non-empty method/property write reflects the same message, while `setCustomValidity('')`,
  `resetValidity()`, `customError = ''`, or `customError = null` clears validity and removes the
  attribute. Serialized or cloned markup therefore cannot resurrect a message already cleared at
  runtime.
  Two behaviors are inherited verbatim from native controls and are the ones worth knowing.
  **Clearing restores computed validity rather than forcing the control valid** — a
  required-and-empty field whose custom error is cleared is still `valueMissing`. And **the custom
  error outlives everything except another `setCustomValidity('')`**: it survives each intrinsic
  recomputation (every `value`/`required` change re-runs one) and survives `form.reset()`. Clear it
  yourself when the condition that raised it goes away. The message is your content, so it is
  emitted verbatim and never localized — pass a string already in the user's language.
- **`customError` and `lr-invalid`.** Assigning `customError` is the reflected property form of
  `setCustomValidity()`; assign `null` to clear it and remove `custom-error`. Whenever the native
  non-bubbling `invalid` event fires, the host also emits exactly one bubbling, composed
  `lr-invalid` alias with no detail.

  **`lr-invalid` is cancelable, and cancelling it cancels the native event too.** It is one of the
  library's few real veto points: `event.preventDefault()` on `lr-invalid` forwards the cancellation
  to the platform `invalid` event that triggered it, which suppresses that event's default —
  the browser's own validation bubble, and the focus/scroll `reportValidity()` performs on the first
  invalid control. That is what lets an app render its own error banner from `lr-invalid` without the
  native UI appearing alongside it. Nothing else changes: the control is still invalid, still fails
  `checkValidity()`, and still blocks submission.

  ```ts
  form.addEventListener("lr-invalid", (event) => {
    event.preventDefault(); // no native bubble, no auto-scroll
    showMyOwnErrorSummary(event.target as HTMLElement);
  });
  ```

  Leave it uncancelled to keep the platform behavior. The listener has to be attached before the
  validity check runs (`lr-invalid` bubbles and composes, so the form or `document` is a fine place);
  a `preventDefault()` after the fact does nothing.

- **Validation anchoring.** An internal controller passes
  `internals.setValidity(flags, message, anchor)` with `anchor` = the first focusable descendant in
  the shadow root (`input:not([type='hidden']), textarea, select, button, [tabindex]:not([tabindex='-1'])`),
  re-resolved after each render — the browser cannot focus the non-focusable custom-element host when
  native validation UI tries to reveal the invalid control.
- **Live/default dirty semantics.** A `.value` write changes only the live value and marks it dirty;
  it never reflects the `value` attribute. Declarative markup, `defaultValue`, or a later
  `setAttribute('value', …)` updates the current reset default and updates the live value only while
  it is still pristine. `form.reset()` restores that current default and clears the dirty flag.
  `formStateRestoreCallback()` restores string state synchronously without emitting a user event.
- **Who uses the mixin.** Ten classes take it directly — `lr-input` (and its `lr-number-input` /
  `lr-time-input` subclasses), `lr-textarea`, `lr-code-editor`, `lr-otp-input`, `lr-color-picker`,
  `lr-emoji-picker`, `lr-date-input`, `lr-phone-input`, `lr-chat-composer`, and
  `lr-known-date`. Controls with non-string values or markup-derived defaults hand-roll an
  equivalent with the same `setValidity`/default-capture behavior — `lr-slider` because its value
  is numeric (and its range submission has two entries), `lr-combobox` because its value
  can be an array in `multiple` mode, `lr-select` because its default comes from a `selected`
  `<lr-option>` rather than a `value` attribute. Divergences are documented per component.
  `lr-button` is form-associated only to act as a submit/reset control: it carries no value and no
  validity. `lr-icon-button` is deliberately an action/link primitive rather than a form-associated
  submitter; use an icon-only `lr-button` when the action must submit or reset a form.
  `lr-time-range` is form-associated only for fieldset-cascaded disablement: no submission value,
  no state restoration.

### Enter submits the form

A native `<input>` submits its form owner when the user presses Enter. The `<input>` these controls
render has no form owner at all — it lives in a shadow tree, and only the _host_ element
participates in the light-DOM `<form>` — so the platform can never run implicit submission for it,
and Enter in a text field would silently do nothing, which reads as a broken form. Text-entry
controls implement it themselves, to the platform's rules rather than an approximation of them:

- **Modifiers disqualify the keystroke.** `Ctrl`/`Cmd`/`Alt`/`Shift`+Enter is an application
  shortcut (send-and-keep-open, insert-newline, open-in-new-tab), never implicit submission.
- **An IME composition Enter is not a submit.** Enter commits the highlighted candidate in
  Japanese/Chinese/Korean input; submitting there throws away the word being typed.
- **A `keydown` a listener above already `preventDefault()`ed stays vetoed** — an open suggestion
  panel committing a selection, or your own shortcut, keeps the keystroke.
- **The submitter is resolved, not skipped.** The form's default button — the first enabled submit
  control in `form.elements` — is used as the submitter, so `SubmitEvent.submitter`, that button's
  own `name`/`value` entry, and its `formaction`/`formmethod`/`formnovalidate` overrides all
  survive. An `<lr-button type="submit">` is activated through its own `click()`, since a
  form-associated custom element is never a legal `requestSubmit()` submitter.
- **A submit-button-less form submits only from a single field**, matching the platform's rule that
  a form with no default button refuses implicit submission when more than one text-entry field
  blocks it.
- **Validation still runs.** Submission goes through `requestSubmit()`, never `submit()`, so an
  invalid field blocks it exactly as a real submit button would.

**Deliberately not wired everywhere**, because Enter already means something else: `lr-textarea` and
`lr-code-editor` insert a newline (the whole point of a multi-line surface); `lr-select`'s trigger is
a `role="combobox"` where Enter opens the listbox and then commits the active option, per the ARIA
combobox pattern; `lr-date-picker` selects the focused day. A `disabled` or `readonly` control stays
inert either way.

## CSS custom states

Every value-carrying form-associated control publishes its validation state as CSS custom states, so
a light-DOM stylesheet can react to validity without reaching into a shadow root or mirroring the
state onto an attribute of your own:

```css
lr-input:state(user-invalid)::part(input-wrapper) {
  border-color: var(--lr-color-danger-border-loud);
}
```

Six states, in three pairs:

| State                         | Matches when                                           |
| ----------------------------- | ------------------------------------------------------ |
| `required` / `optional`       | the control's `required` is set / is not set           |
| `valid` / `invalid`           | `validity.valid` is `true` / `false`                   |
| `user-valid` / `user-invalid` | the same, **and** the control has been interacted with |

Exactly one of the first two pairs matches at any moment. The third is the one that differs:
**before the control has been interacted with, neither `user-valid` nor `user-invalid` matches** —
and that is precisely what makes the pair worth having. A pristine required field is genuinely
`invalid` from the moment it connects, so a rule on `:state(invalid)` paints an untouched form red
before the user has typed anything; the same rule on `:state(user-invalid)` waits.

"Interacted with" means an `input`, `change` or blur on that control, or a `reportValidity()`
call — which is what a submit attempt runs, so a failed submit switches the `user-*` states on for
every field that failed. `form.reset()` makes the control pristine again and they stop matching.
`setCustomValidity()` participates like any other constraint: raising a custom error flips `invalid`
immediately, and `user-invalid` too if the control has already been touched.

**A control barred from constraint validation publishes neither `valid` nor `invalid`** — and
therefore neither `user-valid` nor `user-invalid`. "Barred" is the platform's own term and the
platform's own list: the control's own `disabled`, an ancestor `<fieldset disabled>`, `readonly`
where the control has it, or anything else that makes `willValidate` false. A native
`<input required disabled>` matches neither `:valid` nor `:invalid`, and these states match native.
This matters because the idiomatic rule is written against the _tag_:

```css
lr-input:state(user-invalid)::part(input-wrapper) {
  border-color: var(--lr-color-danger-border-loud);
}
```

A disabled required field that still published `invalid` painted every greyed-out control in the
form red. `required`/`optional` are unaffected — they describe the attribute, not the validation
outcome, so they keep publishing exactly like native `:required`/`:optional`, and a disabled
required field still matches `:state(required)`. Style the barred case through
`:state(disabled)`/`:disabled` and `:state(readonly)`, not through the validity pair.

The states are published the same way whether a control uses the `FormAssociated` mixin or drives
`ElementInternals` directly, so a rule written against `lr-input` behaves identically on
`lr-checkbox`. `lr-button` is the form-associated exception noted above: it has no value and
therefore no validity to publish. `lr-icon-button` is not form-associated at all. Where an engine
cannot register a custom state, the styling hook is simply absent — validity, submission blocking
and `checkValidity()`/`reportValidity()` are unaffected, so never make a `:state()` rule the only
signal that a field is wrong.

## The required-field marker

A labelled control with `required` set paints a marker after its label text — by default ` *` in
`--lr-color-danger`. It is one shared contract and, with one fieldset-specific exception, one shared
rule rendered as an `::after` on the `form-control-label` part: the labelled form controls, plus
`lr-file-input`, `lr-model-select`, `lr-voice-picker`, and `lr-tool-param-form`, which marks its
_per-field_ labels the same way. `lr-known-date` reads the same three properties but paints the
marker on its `legend` box, after the complete label; its `form-control-label` part owns only the
label content and cannot retheme that marker. A control with no
`form-control-label` part — `lr-checkbox`, `lr-switch`, `lr-radio`, whose default slot _is_ the
visible label — has no label box to hang a marker on and paints none; a control that renders the
part with no label text set paints none either, so no stray glyph is ever orphaned.

Three custom properties control it. Each is read as an inline `var()` fallback at the point of use,
never declared on `:host`, so setting one on **any ancestor** of the control reaches it — and one
declaration on `:root` retunes every marker in the application at once:

| Property                             | Default                  | What it does                                                                                                 |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `--lr-form-control-required-content` | `' *'`                   | The marker itself, as a CSS `content` string. Must be _quoted_.                                              |
| `--lr-form-control-required-color`   | `var(--lr-color-danger)` | The marker's colour, independent of every other danger surface.                                              |
| `--lr-form-control-required-offset`  | `0`                      | Inline space between the label text and the marker (a logical `margin-inline-start`, so it flips under RTL). |

```css
/* mark the requirement in words, in the page's language */
:root {
  --lr-form-control-required-content: " (required)";
  --lr-form-control-required-color: var(--lr-color-text-quiet);
  --lr-form-control-required-offset: var(--lr-space-2xs);
}

/* or suppress the marker entirely and rely on your own label copy */
lr-input.no-marker {
  --lr-form-control-required-content: "";
}
```

Three things follow from `content` being a consumer-supplied string:

- **It is never localized by the library.** `localize()` covers strings the library authors; this
  one is yours, so a translated marker (` (obligatoire)`, ` (必須)`) is set per locale by the
  application — one declaration on the root element beside whatever else the locale switch changes.
- **The default's leading space is part of the glyph**, which is why
  `--lr-form-control-required-offset` defaults to `0`. A replacement string that omits the space
  should set an offset rather than baking one in, so the spacing stays a length.
- **Suppressing the marker is a styling change, not a semantic one.** `required` still reflects,
  still reaches the accessibility tree through the control's own `aria-required`, still publishes
  `:state(required)`, and still fails `valueMissing`. If the marker is the only way a form
  communicates requiredness, replace it with visible copy rather than removing it.

## Presenting hint text as a compact disclosure

Every form control's `hint` chrome (props + matching named slot + `hint` CSS part, the same shape
`<lr-select>` documents) renders as permanent text under the control. **There is no
`hint-display`/`hint-placement` attribute anywhere in the library, on any control, and none is
planned** — a compact icon-triggered presentation is a composition you build from existing pieces,
not a built-in render mode. Permanent text is also the reason a hint reads reliably across a form in
the first place: a control that silently switched between "text under the control" and "icon that
opens a popup" from one attribute would desync sibling field heights at exactly the moment it
removed the visual cue that anything had changed.

The recipe: compose an icon-only `<lr-icon-button>` inside an `<lr-tooltip>` — or `<lr-details>` for
an inline expand/collapse instead of a hover/focus popup — and slot the pair into the control's
`label` slot, beside its regular label text. This works on every control shipping that label/hint
slot pair (`lr-input`, `lr-textarea`, `lr-select`, `lr-combobox`, `lr-number-input`, `lr-date-input`,
and siblings). Keep the same copy in the control's own `hint` slot as well, wrapped in the
`lr-visually-hidden` utility class (opt into it with `@import "@aceshooting/lyra-ui/utilities.css";`
— see "Optional native styles and CSS utilities" below): that keeps the text wired into the
control's `aria-describedby`, which is the entire reason the built-in `hint` chrome exists, while
removing its visible, height-affecting rendering. The compact trigger is additive to that
description, not a replacement for it — `<lr-tooltip>` separately gives its own trigger (the icon
button) an accessible description built from the tooltip's content while open, which is a second,
narrower win: it reaches only the icon button's own focus, not the field's `aria-describedby` chain,
which is exactly why the visually-hidden copy in `hint` still matters.

```html
<lr-input label="API key" name="apiKey">
  <lr-tooltip
    slot="label"
    content="Used to authenticate requests server-side. Rotate it if it leaks."
  >
    <lr-icon-button
      icon="info-circle"
      label="More info about API key"
    ></lr-icon-button>
  </lr-tooltip>
  <span slot="hint" class="lr-visually-hidden"
    >Used to authenticate requests server-side. Rotate it if it leaks.</span
  >
</lr-input>
```

```js
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-ui/components/lr-tooltip.js';
import '@aceshooting/lyra-ui/components/lr-icon-button.js';
```

`icon="info-circle"` above illustrates the pattern; `<lr-icon>`'s own built-in glyph set has no info
symbol (see `llms/components/lr-icon.md` for the exact list), so register a real icon library with
`registerIconLibrary()`, set `library` alongside `icon`, or slot custom SVG geometry into the icon
button's own default slot instead.

`lr-checkbox` and `lr-switch` have no separate `label` slot — their default slot _is_ the clickable
label — so there is nowhere inside either control to slot the trigger into. Render it as a DOM
sibling instead, still paired with a visually-hidden copy inside the control's own `hint` slot:

```html
<span class="lr-cluster lr-items-center lr-gap-xs">
  <lr-checkbox name="marketingOptIn">
    Send me product updates
    <span slot="hint" class="lr-visually-hidden">We email at most once a month.</span>
  </lr-checkbox>
  <lr-tooltip content="We email at most once a month.">
    <lr-icon-button icon="info-circle" label="More info about product updates"></lr-icon-button>
  </lr-tooltip>
</span>
```

## Preventing layout shift from lazy-upgrading elements (CLS)

An undefined custom element is an inline box with no intrinsic size, so every `lr-*` in the initial
viewport contributes a reflow as its definition loads. Components that additionally defer on an
optional peer (`lr-chart`, `lr-map`, `lr-flag`, `lr-flow-canvas`, `lr-graph`,
`lr-knowledge-graph-explorer`)
render a skeleton while that peer resolves, which can cost a second shift when the real content
replaces it. Each component is individually well-behaved; the aggregate on a first paint is what
costs a Lighthouse Cumulative Layout Shift score.

Lyra ships an optional, opt-in stylesheet that reserves each component's intrinsic footprint before
upgrade:

```css
@import "@aceshooting/lyra-ui/reservations.css";
```

It styles **only** `:not(:defined)` elements, inside an `@layer lr-reservations`, so it becomes inert
the moment a definition upgrades and can never fight a component's own layout. It sets no colors and
no `:root` rules.

**Every reservation is expressed with the same custom property and fallback token the component's
own stylesheet uses** — `--lr-chart-height` / `--lr-size-280px` for the chart family,
`--lr-map-height` for `lr-map`, `--lr-canvas-reserved-height` for graph/canvas surfaces,
`--lr-flag-aspect-ratio` for `lr-flag`, `--lr-form-control-height` for the field controls, and so
on. That is the point of shipping it rather than documenting measured pixel values: a hand-written
reservation rots silently the moment a component's default changes, whereas these track it, and
theming a component through its documented custom property re-themes its reservation with it.

Hand-rolling equivalent rules is still fine — the pattern is just:

```css
lr-chart:not(:defined) {
  display: block;
  min-block-size: var(--lr-chart-height, var(--lr-size-280px));
}
```

Three things worth knowing:

- **It reserves layout only for `lr-*` usages in the exact tree it is loaded into.** A `<link>`/
  `@import` reaching the document reserves the document's own light-DOM `lr-*` usages; it does not
  reach one that a *different* component renders inside *that component's own* shadow root, because
  a document stylesheet never crosses a shadow boundary. If your own component's template composes
  `lr-*` elements, load the reservations there too, in whichever form matches how your component is
  built: adopt `@aceshooting/lyra-ui/reservations.styles.js`'s `reservationStyles` export (a Lit
  `CSSResult` generated from the same `reservations.css`, so the two can never drift) —
  `static styles = [reservationStyles, css\`…\`]`, or
  `shadowRoot.adoptedStyleSheets = [reservationStyles.styleSheet!]` outside Lit — or `<link>`/
  `@import` `reservations.css` again inside that shadow root if you are not using constructed
  stylesheets at all.
- A per-instance override needs the matching custom property to be set as well, not only the
  attribute, or the pre-upgrade frame and the upgraded frame will disagree. `<lr-chart height="500px">`
  should carry `style="--lr-chart-height: 500px"` too if it sits above the fold.
- The reservation covers the definition-upgrade shift. A component that then swaps a skeleton for
  peer-resolved content stays stable as long as the reserved box matches the final footprint, which
  is why the reservations target each component's *final* default size rather than its skeleton's.

## Scope: what this library does not provide

Lyra is a component library, not an application framework. The following are deliberately out of
scope, so they are worth not searching the catalog for:

- **Client-side routing.** There is no router and no route-outlet component. URL ownership belongs to
  the application (or its router of choice), because a component library that took it over would
  conflict with every framework router a consumer might already run. The navigation components are
  designed to be *driven* by whatever router you use rather than to own the URL themselves:
  `lr-app-rail-item`, `lr-breadcrumb-item` and `lr-tab-group` all expose their active/selected state
  as ordinary reflected properties, so binding is a one-way write from your route state plus a click
  handler that calls your router. Wire it once in your shell component; there is no Lyra-specific
  pattern to learn.
- **Data fetching, caching, and state management.** Components take data as properties and emit
  events; they never fetch on your behalf, except the documented viewers/`src`-taking components,
  which are explicit about it.
- **Form submission and validation orchestration.** Form-associated controls integrate with the
  native `<form>`/`ElementInternals` contract; the submission lifecycle stays the application's.

## Accessibility contract

Semantic roles live on the shadow-DOM element that owns them, with explicit false states for
toggle/selection/expansion ARIA attributes and deliberate host-name forwarding. Form-associated
controls preserve `ElementInternals`, reset, validity, focus, and native editing behavior. Reusable
layouts respond to their allocated container rather than the viewport, and decorative or infinite
motion simplifies under `prefers-reduced-motion: reduce`.

Keyboard model: a composite widget (menu, tab group, tree, table, calendar, carousel, segmented
control) is a single tab stop using a roving `tabindex`; arrow keys move within it and skip disabled, hidden,
`aria-hidden` and `inert` items; `Home`/`End` jump to the ends; `Enter` and `Space` both activate;
`Escape` dismisses the topmost dismissible overlay and returns focus to whatever opened it.
`ArrowLeft`/`ArrowRight` mean previous/next and swap under `dir="rtl"`.

**Hover/focus surfaces open on keyboard focus.** The `focus` trigger of `lr-tooltip` (default
`hover focus`), `lr-popover` and `lr-dropdown`, and the hover/focus surfaces of `lr-copy-button`,
`lr-app-rail-item`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-citation-badge` and
`lr-entity-chip`, open on focus only when the element that actually holds focus matches
`:focus-visible` and no pointer press has been seen since the last key press. So pointer, touch and
scripted focus that follows them — a drawer or dialog moving initial focus to its first control
after a tap, focus restored after a click-closed overlay, a click handler focusing a button — no
longer pops a surface, and a non-keyboard focus never cancels a pending hide. Focus that re-enters
the document from outside it (browser UI, another window, a child frame) is judged by the
browser's own focus ring. A keyboard-opened drawer shows its initial-focus control's tooltip, and
Escape closing another overlay restores focus with the tooltip open wherever the browser shows the
ring. Focus of any kind still gives `lr-tooltip`, `lr-copy-button`, `lr-usage-badge` and
`lr-tool-call-chip` triggers their accessible description while focus stays on them. A direct tap
still opens hover surfaces through the browser's compatibility `mouseenter`. Call `show()` for a
scripted reveal; tests should move focus with a real Tab key or call `show()` rather than `.focus()`
or synthetic focus events.

Lyra UI does not make a formal assistive-technology conformance claim or provide a VPAT. For the
documented accessibility scope and how to report an accessibility issue, see
<https://github.com/aceshooting/lyra-ui/blob/main/docs/accessibility.md>.

### Host accessible names and compatibility properties

Use the host `aria-label` attribute or native `ariaLabel` property to name a component. Where the
component owns an internal role, it forwards that host name to the semantic element. An explicitly
present host name, including `aria-label=""`, wins over the retained `accessibleLabel` fallback.
This applies to `lr-table`'s grid and `lr-sequence-strip`'s list as well.

On `lr-attachment-trigger`, `lr-callout`, `lr-carousel`, `lr-dialog`, `lr-drawer`, `lr-file-input`,
`lr-lite-chart`, `lr-progress-bar`, `lr-progress-ring` and `lr-reorder-item`, the older
`accessible-label` attribute is deprecated with removal no earlier than 23.0.0. Their
`accessibleLabel` properties have a separate deprecation window, with removal no earlier than
24.0.0. On `lr-table` and `lr-sequence-strip`, both `accessible-label` and `accessibleLabel` are
deprecated with removal no earlier than 24.0.0. These compatibility names remain functional during
their respective windows and can issue one-time development notices; use the native host name for
new code. The migration reference lists each attribute and property independently.

`lr-message-parts` retains a deprecated nullable `accessibleLabel` property, with removal no earlier
than 24.0.0. It maps to the current `aria-label` attribute: authoring that attribute updates the
property, and removing it restores `null` and the localized default name. Normal host attribute
use and removal are supported without deprecation warnings. Assigning a non-null value directly to
`accessibleLabel` while no host `aria-label` is present remains a working fallback and warns once
in development. Use the host `aria-label` or native `ariaLabel` instead; an explicitly empty host
name still takes precedence.
