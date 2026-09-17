import { acquireNativeControlDescription, type NativeControlDescriptionLease } from '../../../internal/native-control-description.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Placement } from '@floating-ui/dom';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import {
  deferredPlaceReady as place,
  type DeferredOperationHandle,
} from '../../../internal/anchored-overlay-runtime.js';
import type { PlaceStrategy, PlaceSync } from '../../../internal/positioner.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import type {
  LyraPickerDetailValue,
  LyraPickerValue,
} from '../../../internal/picker-value.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import {
  activateNonmodalOverlay,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import {
  AnchoredValidityController,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { DebounceController } from '../../../internal/debounce-controller.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import { styles } from './select.styles.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type { LyraOption } from '../combobox/option.class.js';
import '../combobox/option.class.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import {
  omittedEmptyStringConverter,
  optionalLiteralSetConverter,
} from '../../../internal/converters.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  isOptionSelectedDirty,
  isOptionSelectedWrite,
  wasOptionInitiallySelected,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { tag } from '../../../internal/prefix.js';
import {
  currentValidityValidator,
  type LyraFormValidator,
} from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_loading, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_select, LYRA_DEFAULT_selectSelectedOverflow, LYRA_DEFAULT_selectValueMissing } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** How long the listbox type-ahead buffer survives without a keystroke. Unchanged from the
 *  inline literal this reset used before it moved onto the shared debounce controller. */
const TYPE_AHEAD_RESET_MS = 500;

function isLyraOptionElement(value: unknown): value is LyraOption {
  return isHtmlElement(value) && value.localName === tag('option');
}

/**
 * Normalizes a `value`/`defaultValue` assignment to the committed array form. `undefined` and
 * `null` mean "clear" -- the documented contract for an unset assignment -- while every string,
 * INCLUDING `''`, is a candidate value to resolve against the current options: `<lr-option
 * value="">` is a legitimate row, so an empty string must round-trip as a real selection rather
 * than being silently folded into "clear" the way a falsy check would.
 */
function normalizeSelectionValues(
  next: string | string[] | null | undefined
): string[] {
  if (Array.isArray(next))
    return next.filter((value): value is string => typeof value === 'string');
  return typeof next === 'string' ? [next] : [];
}

/** Re-exported so a consumer importing only the select subpath can still name the shared
 *  positioning vocabulary `positioningStrategy` uses. */
export type { LyraPickerDetailValue, LyraPickerValue, PlaceStrategy };

/** Unsupported values resolve to *absent* so the control's own mirrored default stays the
 *  fallback, rather than a member baked into the converter. */
const POSITIONING_STRATEGY = optionalLiteralSetConverter<PlaceStrategy>([
  'absolute',
  'fixed',
]);

/** Renders one selected option's chip in `multiple` mode. Whatever it returns replaces the
 *  built-in `[part='tag']` chip for that option, so a caller that wants the default styling
 *  hooks re-declares `part="tag"` on its own root node. A returned string renders as **text**,
 *  never as markup. */
export type LyraSelectTagRenderer = (
  option: LyraOption,
  index: number
) => unknown;

export interface LyraSelectEventMap<Multiple extends boolean = boolean> {
  'lr-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  /** `detail.data` is index-aligned with `detail.value`: `data[i]` is the opaque `data` payload
   *  behind `value[i]`, by reference and never deep-cloned, or `undefined` for a value resolving
   *  to no live option -- see `isUnknownValue()`. */
  'lr-input': CustomEvent<
    LyraEventDetailSnapshot<{
      readonly value: LyraPickerDetailValue<Multiple>;
      readonly data: readonly unknown[];
    }>
  >;
  /** `detail.data` is index-aligned with `detail.value`: `data[i]` is the opaque `data` payload
   *  behind `value[i]`, by reference and never deep-cloned, or `undefined` for a value resolving
   *  to no live option -- see `isUnknownValue()`. */
  'lr-change': CustomEvent<
    LyraEventDetailSnapshot<{
      readonly value: LyraPickerDetailValue<Multiple>;
      readonly data: readonly unknown[];
    }>
  >;
  'lr-activate': CustomEvent<{ value: string }>;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * Stable per-event aliases, so a host can name one event's type without restating the detail
 * schema (or re-deriving it from `LyraSelectEventMap`). Each narrows with the same `Multiple`
 * parameter the component does: `LyraSelectChangeEvent<false>`'s `detail.value` is a `string`.
 */
export type LyraSelectChangeEvent<Multiple extends boolean = boolean> =
  LyraSelectEventMap<Multiple>['lr-change'];
export type LyraSelectInputEvent<Multiple extends boolean = boolean> =
  LyraSelectEventMap<Multiple>['lr-input'];

/**
 * `<lr-select>` — a plain closed-list dropdown: a direct `<lr-*>`
 * counterpart to `<wa-select>`/`<wa-option>`. Trigger is a button (not a text
 * input) -- click/Enter/Space/ArrowDown opens it, there's no typing-to-filter.
 * A printable keypress instead jumps (or, while closed, directly selects) the
 * next option whose label starts with what's been typed, like a native
 * `<select>`'s type-ahead. Closed multiple mode skips selected option occurrences and keeps
 * searching for a later unselected match, including another occurrence of the same value.
 *
 * Options are `<lr-option value>` children, the same element `<lr-combobox>`
 * uses. Unlike `lr-combobox` there is no filter/source/empty-text/max-render
 * surface -- see `<lr-combobox>` for the filterable case.
 *
 * `multiple` turns the committed `value` into a `string[]` and renders one removable chip per
 * selection. The chip row is a sibling overlaid on the real trigger button, never nested inside it,
 * so every remove control is valid independently-focusable interactive content. The trigger keeps
 * one complete visually-hidden joined-value node for assistive technology while the painted
 * built-in chip labels are hidden from it, preventing both truncation and duplicate announcement.
 * Picking a selected row again still toggles it off, Backspace/Delete on the trigger removes the
 * last selection, and `with-clear` removes all of them. `getTag` replaces a built-in chip entirely;
 * `max-options-visible` caps how many render before the rest collapse behind a localized "+N" chip.
 *
 * `with-clear`'s button renders inside the trigger's inline-end padding,
 * outboard of the expand icon, as a sibling of the trigger rather than a child
 * of it -- for the same nesting reason.
 * The trigger and overlaid multi-select tag row accept constrained allocation: long selected
 * labels ellipsize and long chips wrap within a 320px LTR or RTL container instead of widening it.
 *
 * Reuses `lr-combobox`'s popup positioning (`internal/positioner.js`) and
 * click-outside/Escape/Home/End/Arrow-key listbox navigation patterns,
 * adapted to a trigger button that keeps DOM focus throughout (the listbox's
 * "active" row is conveyed via `aria-activedescendant`, never actual focus),
 * matching the WAI-ARIA "select-only combobox" pattern.
 *
 * When `autoCommitSingleOption` is set and exactly one option is available
 * (neither disabled nor inert, including through an inert ancestor), the popup never
 * opens at all: a click, Enter, Space, ArrowDown, or ArrowUp on the trigger
 * commits that sole option directly, and the trigger renders as a plain
 * `role="button"` with no chevron/`aria-haspopup`/`aria-expanded` rather than
 * a combobox with a permanently inert popup state — opening a one-row list to
 * pick the only available choice is pure friction with no real decision
 * behind it. This never changes `value`/validity defaults on its own — an
 * unselected single-option select stays unselected (and a `required` one
 * stays invalid) exactly like the multi-option case, until the trigger is
 * actually activated. `autoCommitSingleOption` defaults to `false`: by
 * default a select always renders the normal combobox/listbox/chevron
 * trigger no matter how many options are enabled, matching pre-1.3.0
 * behavior — opt in explicitly if a narrowing-to-one option list should
 * auto-commit.
 *
 * Deliberately does **not** perform implicit form submission on Enter (unlike `<lr-input>`/
 * `<lr-combobox>`/`<lr-date-input>`, which route through `internal/submit-on-enter.ts`): the
 * trigger is a `role="combobox"` button where Enter opens the listbox and, once open, commits the
 * active option — the ARIA combobox behavior its upstream counterpart follows. Submitting there
 * would shadow the only keyboard way to open the list.
 *
 * While the listbox is open, live option collection changes preserve the keyboard-active option
 * by element identity across reorders. If that option is removed or becomes unavailable, the
 * nearest available survivor takes over (preferring the following row on a tie); an empty
 * available collection clears `aria-activedescendant` instead of retaining an invalid index.
 *
 * Host `aria-describedby` targets supplement internal hint/error guidance on the semantic
 * control, including live target replacement and document adoption. Removing label, hint, or
 * error attributes safely omits their content while retaining native null property readback.
 * Mounted option `selected` writes immediately update the live value and submission silently;
 * reset defaults stay independent, and later default changes preserve a dirty selection.
 *
 * Assigning `undefined`/`null` to `value`/`defaultValue` clears the selection; every string,
 * including `''`, is instead a candidate value resolved against the current options -- an
 * `<lr-option value="">` is a legitimate row and now round-trips like any other. A committed value
 * matching no current option (a stale value, or a programmatic assignment with a typo) still
 * commits rather than being dropped, but renders with a dashed/italic `[part='unknown-value']`
 * badge instead of silently passing the raw string off as an ordinary label -- see
 * `isUnknownValue()`. Set `loading` while that same value's catalog simply hasn't arrived yet (an
 * async fetch still in flight, say): a still-unmatched value then renders the localized `loading`
 * placeholder instead, with no `unknown-value` badge, since it is not yet known to be missing. The
 * same flag covers an empty selection too -- with nothing selected the trigger shows that same
 * localized text in place of `placeholder`, so both halves of a pending state read the same words
 * without a consumer re-localizing them.
 *
 * A slotted `<lr-option>`'s `start`/`end` (and the Shoelace `prefix`/`suffix` aliases) adornments
 * are cloned into the corresponding `[part='option-start']`/`[part='option-end']` listbox row,
 * mirroring `<lr-combobox>`.
 *
 * @customElement lr-select
 * @slot - `<lr-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Custom error content.
 * @slot start - Decorative adornment at the inline-start of the trigger row, before the
 *   selected-value label. Its wrapper is always `aria-hidden` and inert because it lives inside
 *   the native trigger button; interactive content supplied here remains deliberately unavailable.
 * @slot end - Decorative adornment after the selected-value label and before the expand icon.
 *   Its wrapper has the same enforced inert/`aria-hidden` contract as `start`.
 * @slot prefix - Shoelace alias for `start`.
 * @slot suffix - Shoelace alias for `end`.
 * @slot clear-icon - Replaces the built-in clear glyph.
 * @slot expand-icon - Replaces the built-in expand glyph.
 * @event {Event} change - Fired when the selection changed, mirroring native
 *   `<select>`'s own event name. Read the new selection from `value`.
 * @event {InputEvent} input - Fired alongside `change` on every
 *   selection change (native `<select>` doesn't meaningfully distinguish the two either).
 * @event lr-input - Prefixed compatibility alias for `input`; `detail: { value, data }`, where
 *   `data` is the opaque `data` payload of each newly committed occurrence (see `selectedData`),
 *   by reference, never deep-cloned.
 * @event {CustomEvent<LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }>>} lr-change - Prefixed compatibility alias
 *   fired after `input` and `change` on the same selection change, mirroring `<lr-checkbox>`'s
 *   `lr-change`. Not fired for a programmatic `value` assignment. `detail.data` mirrors `lr-input`.
 * @event lr-activate - Fired on every activation of an available listbox row -- a click, or
 *   Enter/Space on the active row -- whether or not the selection actually moved.
 *   `detail: { value }` carries the activated option's own value, always a single string even in
 *   `multiple` mode. Bubbling and composed, so a host outside the shadow tree receives it.
 *   Not cancelable: it is a notification that the user picked a row, not a veto point, and nothing
 *   in this component branches on it. In single-select mode, re-picking the already-selected row is
 *   the case `change`/`lr-change` deliberately stay silent for (matching a native `<select>`) --
 *   "re-run that filter" is a real intent -- and it is otherwise unobservable, because the rows
 *   live in this shadow root, so a retargeted `click` names no option and a keyboard commit
 *   produces no click at all. When an activation does move the selection,
 *   `input`/`lr-input`/`change`/`lr-change` are emitted first. Not fired for a programmatic
 *   `value` assignment, nor by the `with-clear` button.
 * @event lr-clear - The `with-clear` button emptied the selection, fired after the
 *   `input`/`lr-input`/`change`/`lr-change` sequence. Never fired when there was nothing to clear.
 * @event lr-show - The listbox is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed and the reflected attribute untouched.
 * @event lr-hide - The listbox is about to close, however `open` became false. Conditionally
 *   cancelable: connected transitions can be vetoed on the same terms as `lr-show`; an
 *   already-removed element closing on disconnect cannot honour a veto. Disabling the control,
 *   directly or through a fieldset, force-closes it without this vetoable lifecycle because a
 *   disabled control cannot retain an interactive popup.
 * @event lr-after-show - The listbox finished opening and its transition settled.
 * @event lr-after-hide - The listbox finished closing and its transition settled.
 * @event lr-invalid - The select failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @event blur - Re-dispatched from the trigger as a bubbling, composed event.
 * @event focus - Re-dispatched from the trigger as a bubbling, composed event.
 * @cssstate required - Matches while `required` is set. Style with `lr-select:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: picking an option, a
 * blur, `reportValidity()`, or a submission attempt. Not after a silent `checkValidity()` alone.
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required select is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate blank - Matches while no option is selected.
 * @csspart form-control - The outer wrapper around label, trigger, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Wrapper around the visible label content.
 * @csspart form-control-input - Compatibility name for the control wrapper.
 * @csspart combobox - Compatibility name for the control wrapper.
 * @csspart trigger - The trigger button (positioning anchor).
 * @csspart display-input - The selected-value/placeholder display inside the trigger. In populated
 *   multiple mode it is visually hidden but exposes every selected label to assistive technology.
 * @csspart start - Inert, decorative wrapper around the `start` adornment slot; `hidden` while
 *   nothing is slotted.
 * @csspart end - Inert, decorative wrapper around the `end` adornment slot; `hidden` while nothing
 *   is slotted.
 * @csspart prefix - Shoelace compatibility part on the `prefix` slot.
 * @csspart suffix - Shoelace compatibility part on the `suffix` slot.
 * @csspart tags - The `multiple`-mode chip row, rendered as a sibling overlaid on the trigger.
 * @csspart tag - One selected-value chip. The "+N" overflow chip carries both `tag` and
 *   `tag-overflow`, so `::part(tag)` styles every chip and `::part(tag-overflow)` only that one --
 *   state after `::part()` never matches, so it is encoded in the part name instead.
 * @csspart tag-label - A chip's ellipsis-safe label.
 * @csspart tag__base - Compatibility name on a built-in selected-value chip.
 * @csspart tag__content - Compatibility name around a built-in chip's visible label.
 * @csspart tag__remove-button - A built-in chip's remove button.
 * @csspart tag__remove-button__base - Compatibility name on the same remove button.
 * @csspart tag-overflow - The "+N" chip standing in for the selections past `max-options-visible`.
 * @csspart clear-button - The `with-clear` button.
 * @csspart listbox - The managed nonmodal options popover; its stack depth comes from
 *   `--lr-overlay-stack-index` with `--lr-layer-dropdown` as the standalone fallback.
 * @csspart group-label - An option group's heading row, referenced by the enclosing `role="group"`.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-start - An option row's leading adornment, cloned from the source
 *   `<lr-option>`'s `start`/`prefix` slot. Inert and aria-hidden.
 * @csspart option-end - An option row's trailing adornment, cloned from the source
 *   `<lr-option>`'s `end`/`suffix` slot. Inert and aria-hidden.
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart option-badge - The localized "not in catalog" badge on a synthetic unmatched-value row
 *   (`show-unknown-option` only).
 * @csspart unknown-value - Badge shown next to the trigger label or a `multiple`-mode tag when the
 *   committed value matches no current `<lr-option>` (see `isUnknownValue()`).
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - The error message.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace compatibility name for the hint message.
 * @cssprop --lr-select-expand-size - Decorative expand-icon box size, scaled by `size`. The one
 *   piece of this component's geometry the shared ladder does not own: it sizes a glyph, not the
 *   control row.
 * @cssprop --lr-select-gap - Gap between the trigger's start adornment, label, end adornment, and
 *   expand icon. Doesn't vary by `size`.
 * @cssprop [--lr-select-radius=var(--lr-form-control-radius)] - Trigger corner radius, from the
 *   active `size` tier of the shared form-control ladder (the two tightest tiers take a smaller
 *   radius).
 * @cssprop --lr-select-trigger-padding - Trigger padding shorthand. Defaults to the active `size`
 *   tier's `var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)` from the
 *   shared ladder.
 * @cssprop [--lr-select-trigger-min-height=var(--lr-form-control-height)] - Trigger block-size
 *   floor, from the active `size` tier of the shared ladder, and live at every tier including the
 *   default `m` -- so a select is exactly as tall as an `<lr-button>`/`<lr-input>` of that tier.
 * @cssprop [--lr-select-font-size=var(--lr-form-control-font-size)] - Trigger font size, from the
 *   active `size` tier.
 * @cssprop --lr-select-tag-padding - Padding inside a `multiple`-mode chip. Doesn't vary by `size`.
 * @cssprop --lr-select-tag-font-size - Chip text size. Doesn't vary by `size`.
 * @cssprop [--lr-select-unknown-value-border-style=dashed] - Border style of an `[part='unknown-value']`
 *   chip (a `multiple`-mode tag whose committed value matches no current option).
 * @cssprop [--lr-select-unknown-value-border-color=var(--lr-color-border)] - Border color of the
 *   same unknown-value chip.
 * @cssprop [--lr-select-option-badge-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part='option-badge']` "not in catalog" badge.
 * @cssprop [--tag-max-size=var(--lr-size-12rem)] - Maximum inline size of one selected-value tag.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Listbox enter-transition timing.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Listbox exit-transition timing.
 * @cssprop [--lr-select-trigger-hover-bg=var(--lr-color-brand-quiet)] - Trigger background while
 * hovered. Accent appearance keeps its louder mixed fallback when this hook is unset.
 * @cssprop [--lr-select-trigger-active-bg=color-mix(...)] - Trigger background while pressed.
 * @cssprop [--lr-select-open-border-color=var(--lr-color-brand)] - Trigger border while the
 * listbox is open.
 * @cssprop [--lr-select-option-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   hovered/keyboard-active option row. Not declared on `:host`, so a value set on any ancestor
 *   is never shadowed -- retheme just this row state without hijacking the shared
 *   `--lr-color-brand-quiet` token used by every other component's own hover/active state.
 * @cssprop [--lr-select-option-selected-bg=transparent] - Background of the currently-selected
 *   option row. Not declared on `:host`; retheme just the selected row without hijacking
 *   `--lr-color-brand`.
 * @cssprop [--lr-select-option-selected-border=var(--lr-color-brand)] - Border color of the
 *   selected option row.
 * @cssprop [--lr-select-option-selected-color=var(--lr-color-brand)] - Text color of the selected
 *   option row.
 * @cssprop [--lr-select-option-selected-font-weight=var(--lr-font-weight-semibold)] - Font weight
 *   of the selected option row.
 * @cssprop --lr-select-trigger-height - Exact trigger height. Unset by default, which leaves
 *   `--lr-select-trigger-min-height` as a floor only; set it to a length to both floor and cap the
 *   trigger (e.g. to pixel-match a sibling field in the same toolbar row). Because it is never
 *   declared by the component itself, it can be set from an ancestor or an outer-tree rule as well
 *   as inline on the element.
 * @cssprop [--lr-select-trigger-fill=var(--lr-color-surface)] - Resting trigger background. Read by
 * every appearance, each falling back to its own default (`--lr-color-surface-raised` for
 * `filled`/`filled-outlined`, `transparent` for `plain`, `--lr-color-brand` for `accent`), so one
 * value retints the trigger whichever treatment it is wearing.
 * @cssprop [--lr-select-trigger-border-color=var(--lr-color-border)] - Resting trigger border
 * color, `transparent` by default on the `filled`/`plain`/`accent` treatments.
 * @cssprop [--lr-select-trigger-hover-border-color=var(--lr-select-trigger-border-color)] - Trigger
 * border color while the pointer is over it. Unset, the border stays exactly where the resting
 * state left it.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the focus outline and
 * border cue are the accessibility answer to focus and are never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the listbox. The listbox is a floating surface, so it retints with every other popup rather
 * than with the trigger it drops from.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the listbox.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, on the
 * listbox.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored listbox.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for
 *   {@link positioningStrategy}/`hoist`, read from computed style when the listbox is
 *   (re)positioned. Set it once on `:root`, a theme, or one clipping ancestor to change every
 *   unset select beneath it instead of authoring `positioning-strategy`/`hoist` on each instance;
 *   an explicit value on the instance always wins over it.
 * @status stable
 * @since 4.0.0
 */
export class LyraSelect<
  Multiple extends boolean = boolean,
> extends LyraElement<LyraSelectEventMap<Multiple>> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    loading: LYRA_DEFAULT_loading,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    select: LYRA_DEFAULT_select,
    selectSelectedOverflow: LYRA_DEFAULT_selectSelectedOverflow,
    selectValueMissing: LYRA_DEFAULT_selectValueMissing,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-input',
    'lr-change',
  ]);
  /** `data` carries opaque per-option caller payload -- preserve each item's identity through the
   *  frozen event envelope instead of recursively cloning unknown data, the same policy
   *  `<lr-prompt-queue>`'s `lr-queue-change` detail uses for its own `items`. */
  protected static override readonly identityEventDetailCollectionItems = Object.freeze({
    'lr-input': Object.freeze(['data']),
    'lr-change': Object.freeze(['data']),
  });

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraSelect>[] {
    return [
      currentValidityValidator('required', 'disabled', 'value', 'multiple'),
    ];
  }
  static formAssociated = true;
  // `sizes` is the library's one form-control ladder, pulled in ahead of this component's own
  // sheet so every `--lr-select-*` geometry knob points at the active tier's value -- and so both
  // spellings of every tier (`s` and `small`, ...) work with no per-component rule.
  static override styles = [LyraElement.styles, sizes, styles, srOnly];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: {
      reflect: true,
      noAccessor: true,
      converter: omittedEmptyStringConverter,
    },
    maxOptionsVisible: {
      type: Number,
      attribute: 'max-options-visible',
      noAccessor: true,
    },
    defaultValue: { attribute: 'default-value', noAccessor: true },
  };

  /** Text shown on the trigger while nothing is selected. It still names the trigger when neither
   *  a host `aria-label` nor a `label` does. One exception to "an empty selection always shows
   *  this": while `loading` is `true` the trigger shows the localized `loading` text instead, so a
   *  consumer never has to re-localize that string in its own catalog to cover the empty half of a
   *  pending state -- see {@link loading}. The trigger's accessible name is unaffected either way.
   * @default '' */
  @property() placeholder = '';
  /** Visible label. A host `aria-label` wins on the internal trigger by attribute presence,
   * including an explicitly empty value that suppresses this label's naming fallback. */
  @property() label = '';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are present. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** SSR slot-presence hints for pre-hydration form chrome. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Forwarded to the internal trigger button. */
  @property({ type: Boolean }) override autofocus = false;
  /** Forwarded to the internal trigger button. */
  @property() override title = '';
  private _open = false;
  /** Whether the listbox is open. Disabled controls synchronously normalize every opening write
   *  back to `false`, including reflected-attribute writes. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const requested = Boolean(next);
    const normalized = requested && !this.effectiveDisabled;
    if (normalized === this._open) {
      // A reflected `open` attribute written while disabled must not remain as a CSS-only open
      // state after the property correctly rejected it.
      if (requested !== normalized && this.hasAttribute('open'))
        this.removeAttribute('open');
      return;
    }
    this.applyOpenState(normalized);
  }
  /** Visual size on the library's one control ladder — shared with `lr-button`/`lr-input`/
   *  `lr-combobox`/`lr-locale-picker`, so same-tier controls line up in a toolbar row. Accepts both
   *  the canonical `'2xs'`–`'xl'` steps and Web Awesome's/Shoelace's `'small'`/`'medium'`/`'large'`
   *  spellings of `s`/`m`/`l`; the two render identically. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Visual treatment of the trigger surface. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  /** Fully-rounded trigger corners. Changes the private radius default to `--lr-radius-pill`, so
   *  an inherited or direct `--lr-select-radius` remains authoritative. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Preferred listbox placement. `flip`/`shift` may still override it to keep the popup in view,
   *  and the `left`/`right` component is swapped under RTL. Changes reposition an already-open
   *  listbox without closing it or changing overlay stack ownership. */
  @property({ reflect: true }) placement: Placement = 'bottom';
  /**
   * Copies the trigger's width, height, or both onto the listbox -- the same property
   * `<lr-popup>`/`<lr-popover>`/`<lr-dropdown>`/`<lr-combobox>` spell, with the same values. Unset
   * (the default), the listbox sizes to its own content, clamped between `--lr-size-12rem` and
   * `--lr-size-28rem`, exactly as before. Set `sync="width"` so a full-width trigger with short
   * option labels gets a listbox that aligns to its own edges instead of floating narrower in the
   * middle -- the content clamp above no longer applies while this is set, since the trigger's own
   * width is now the intentional bound. A synced listbox is still bounded by the space actually
   * measured beside its anchor, so an over-wide trigger cannot push it off-screen. Changes
   * reposition an already-open listbox without closing it.
   * @default undefined
   */
  @property({ reflect: true }) sync?: PlaceSync;
  private _positioningStrategy?: PlaceStrategy;
  /**
   * CSS positioning scheme the listbox is laid out with -- the one property `<lr-select>`,
   * `<lr-dropdown>` and `<lr-popover>` all spell the same way. `absolute` (this control's mirrored
   * default) positions against the nearest containing block and scrolls with it; `fixed` positions
   * against the viewport and escapes most clipping ancestors. An unsupported value resolves back
   * to the default. Changes apply live while open.
   * This property reports only the instance's own authored value (or the mirrored default); the
   * listbox is actually placed with the `--lr-positioning-strategy` cascading custom property
   * honored ahead of that default when the instance itself sets nothing -- see that `@cssprop`.
   * @default 'absolute'
   */
  @property({
    attribute: 'positioning-strategy',
    reflect: true,
    converter: POSITIONING_STRATEGY,
  })
  get positioningStrategy(): PlaceStrategy {
    return this._positioningStrategy ?? 'absolute';
  }
  set positioningStrategy(next: PlaceStrategy) {
    const normalized = POSITIONING_STRATEGY.normalize(next) ?? 'absolute';
    const old = this.positioningStrategy;
    // Recorded even when it matches the already-resolved value: an author who explicitly writes
    // the mirrored default still authored a value, and `resolveEffectivePositioningStrategy()`
    // (positioning-strategy.ts) has to be able to tell that apart from "unset" -- only "unset"
    // falls through to a cascading `--lr-positioning-strategy` ancestor override.
    this._positioningStrategy = normalized;
    if (normalized === old) return;
    this.requestUpdate('positioningStrategy', old);
    // Lit only writes an attribute for a property it saw change, and this write changed `hoist`'s
    // value without going through its own setter.
    if ((old === 'fixed') !== (normalized === 'fixed')) {
      this.requestUpdate('hoist', old === 'fixed');
    }
  }
  /**
   * Retained boolean alias of {@link positioningStrategy}: `hoist` is exactly
   * `positioningStrategy === 'fixed'`, and writing either spelling updates the other so the two
   * attributes can never disagree in the DOM. It is this control's established name (and
   * Shoelace's own spelling on `sl-select`), so it keeps working indefinitely; prefer
   * `positioning-strategy` in new code, which reads the same on every anchored surface.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get hoist(): boolean {
    return this.positioningStrategy === 'fixed';
  }
  set hoist(next: boolean) {
    this.positioningStrategy = next ? 'fixed' : 'absolute';
  }
  /** Shoelace boolean alias for the filled appearance. */
  @property({ type: Boolean, reflect: true }) filled = false;
  /** Show a button that empties the selection while there is anything selected. */
  @property({ type: Boolean, reflect: true, attribute: 'with-clear' })
  withClear = false;
  /** Shoelace's spelling of {@link withClear}, accepted so a mechanical `sl-` → `lr-` rename does
   *  not silently drop the clear button. Prefer `with-clear` in new code. */
  @property({ type: Boolean }) clearable = false;
  /** Renders a selected option's chip in `multiple` mode; see `LyraSelectTagRenderer`. */
  @property({ attribute: false }) getTag?: LyraSelectTagRenderer;
  /**
   * Appends every committed value that no `<lr-option>` claims to the end of the listbox as a
   * synthetic, re-selectable row badged with the localized `notInCatalog` text -- the policy
   * `<lr-model-select>` already ships.
   *
   * Off by default, because it adds a row to a listbox that has always rendered only real options.
   * Turn it on wherever a stored value can outlive its catalog entry: without it, the out-of-list
   * value is visible on the trigger but absent from the listbox, so a user who opens the listbox
   * has no way back to the value they arrived with. No synthetic row appears for a value `loading`
   * is currently suppressing -- see that property -- since it is not yet known to be unmatched.
   * @default false
   */
  @property({ type: Boolean, attribute: 'show-unknown-option', reflect: true })
  showUnknownOption = false;
  /**
   * Renders the label for a committed value that matches no option.
   *
   * `getTag` cannot serve this case: it is handed a matched option, which by definition does not
   * exist here, so the raw value string was the only thing left to render. This hook applies
   * everywhere that value's label appears -- the trigger, a `multiple` tag, and the synthetic
   * listbox row -- and is used only while the value is genuinely unmatched, so it can never
   * override a real option's own label. A blank return falls back to the raw value, exactly as no
   * hook at all would. Caller-supplied text: it is not localized here. Not consulted while
   * `loading` is `true` and the value is still unresolved -- see `loading` below -- because that
   * value is not yet known to be unmatched at all.
   */
  @property({ attribute: false }) getUnknownLabel?: (value: string) => string;
  /**
   * Whether a committed value's real label may still be pending -- e.g. the `<lr-option>` catalog
   * behind it is still being fetched/mounted asynchronously and simply hasn't arrived yet. While
   * `true`, a committed value that currently matches no option (the same condition `isUnknownValue()`
   * tests) renders the localized `loading` placeholder in the trigger label or the relevant
   * `multiple` tag instead of the raw value, and is not flagged with the dashed/italic
   * `notInCatalog`/`[part='unknown-value']` badge a genuinely unmatched value gets, nor added to the
   * synthetic `showUnknownOption` listbox row -- "not yet resolved" is a different state from "known
   * to be missing". With nothing selected at all -- a create form whose catalog is still being
   * fetched, or an edit form whose saved selection is legitimately empty -- the trigger shows that
   * same localized `loading` text in place of `placeholder`, so one property covers the whole
   * pending state rather than only its committed-value half and the two halves always read the
   * same words. The trigger's accessible name is unchanged by this: a host `aria-label` still
   * wins, then `label`, then `placeholder`, then the localized `select` fallback.
   * A value that already matches a live option is unaffected either way. Reflected
   * so `:host([loading])` is available as a styling hook. Never mutates `value`/`selectedOptions`
   * itself, and does not itself disable the trigger -- pair it with `disabled` when the control
   * should also be non-interactive while its catalog is pending.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) loading = false;
  /**
   * Opt-in: when `true` and exactly one `<lr-option>` is enabled, the
   * trigger commits that option directly (click/Enter/Space/ArrowDown/
   * ArrowUp) instead of opening the listbox, and renders as a plain
   * `role="button"` with no chevron. Defaults to `false`, which always
   * renders the normal combobox/listbox/chevron trigger regardless of how
   * many options are enabled — the pre-1.3.0 behavior. See the class doc
   * above and `onlyOption` below for the full rationale.
   */
  @property({ type: Boolean, attribute: 'auto-commit-single-option' })
  autoCommitSingleOption = false;

  @state() private activeIndex = -1;
  /** Stable identity behind `activeIndex`, retained across collection reorder/removal and option
   *  availability changes so the numeric index never silently points at a different row. */
  private activeOption?: LyraOption;
  @state() private options: LyraOption[] = [];
  // Set on the trigger button's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  /** Whether the user has acted on this control yet, which is what gates the `user-valid`/
   *  `user-invalid` custom states. Deliberately separate from `touched` (which drives the visible
   *  `data-invalid`/`aria-invalid` pair and is set on blur alone): picking an option is an
   *  interaction the instant it happens, and so is interactive validation — `reportValidity()` and
   *  a submission attempt alike, via `installInteractionOnInvalid()` — exactly as it does for
   *  native `:user-invalid`. A silent `checkValidity()` alone never counts. Not `@state`: nothing
   *  in `render()` reads it. */
  private hasInteracted = false;
  // `[part]:empty` never matches because the literal `<slot>` child itself counts as content.
  // The shared controller seeds light DOM synchronously and delegates every named slot through one
  // listener, while the option collection below keeps its specialized identity-aware handler.
  private readonly slotPresence = new SlotPresenceController(this);
  @query('[part="trigger"]') private triggerElement?: HTMLButtonElement;
  // The default (unnamed) slot carrying `<lr-option>` children -- read once from `firstUpdated()`
  // in addition to its own `@slotchange` listener; see `collectInitialSlotAssignment`'s doc.
  @query('slot:not([name])') private optionsSlot?: HTMLSlotElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`.
   * @default null */
  declare customError: string | null;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('select-list');
  private triggerId = nextId('select-trigger');
  private valueTextId = nextId('select-value');
  private cleanup?: DeferredOperationHandle;
  private positioningReady: Promise<boolean> = Promise.resolve(false);
  private overlayHandle?: OverlayHandle;
  private restoreFocusOnClose = true;
  private positionedDirection?: 'ltr' | 'rtl';
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private _isFirstUpdate = true;
  private openVetoed = false;
  // A disable-forced close has no vetoable lifecycle, but that suppression belongs only to the
  // exact `open` write that enforced the policy. A later enable + show in the same Lit batch is a
  // new transition and must still emit/settle normally.
  private openStateGeneration = 0;
  private pendingOpenTransitionStart?: boolean;
  private suppressedOpenLifecycleGeneration?: number;
  private transitionToken = 0;
  private transitionWaiters = new Map<
    'lr-after-show' | 'lr-after-hide',
    Set<() => void>
  >();
  // The committed selection, always an array -- capped to one entry outside
  // `multiple` mode, where `value`'s getter unwraps it back to a plain string.
  private _selected: string[] = [];
  // Public values are not required to be unique. Keep the selected options'
  // element identity separately so two same-valued rows never both become
  // selected and a click on the later occurrence cannot route to the first.
  private _selectedOptions: LyraOption[] = [];
  // Preserve the value an occurrence owned at commit time. An option's value may change before
  // its next synchronous selected write, while the committed value list still holds the old text.
  private _selectedValuesByOption = new Map<LyraOption, string>();
  /** Cloned `start`/`end` adornment nodes for each option's listbox row, keyed by the option they
   *  came from. Cached because `renderRows()` runs on every render pass -- mirrors lr-combobox's
   *  identical cache; see `adornmentsFor()`. */
  private adornmentClones = new WeakMap<LyraOption, { start?: unknown; end?: unknown; markup: string }>();
  private _multiple = false;
  private _disabled = false;
  private _required = false;
  // What `form.reset()` restores to. Captured exactly once, from whatever
  // `<lr-option selected>` markup was present the first time slotted
  // options are collected (mirrors native `<select><option selected>`) --
  // never from the `value` setter, so a user picking an option (even the
  // very first pick on an initially-unselected select) can't itself become
  // the reset default. See lr-combobox's identical `_defaultSelected`.
  private _defaultSelected: string[] = [];
  private _defaultSelectedOptions: LyraOption[] = [];
  private _defaultCaptured = false;
  private _valueDirty = false;
  // A restored value must win over declarative selected markup collected by
  // the first asynchronous slotchange. Cleared by the next ordinary value write.
  private _restoredStateActive = false;
  // `value`/`selectedOptions`/`defaultValue` all truncate to a single entry while `multiple` is
  // still (or defaults to) `false`. Before this element's first update, an enclosing template's
  // property bindings commit in source order -- e.g. `.value=${arr}` before a later
  // `.multiple=${true}` -- so the setter can truncate against a `multiple` that hasn't landed yet
  // for this same update. Retaining the raw pre-truncation argument here and re-applying it once
  // more from `willUpdate()`, after `multiple` has settled for this update, re-derives the correct
  // multi-value selection without changing the synchronous, immediately-readable-back behavior a
  // post-mount assignment already relies on. See each setter's own doc.
  private _pendingInitialValue?: string | string[] | null;
  private _pendingInitialSelectedOptions?: LyraOption[];
  private _pendingInitialDefaultValue?: string | string[] | null;
  // Suppresses re-stashing while willUpdate() re-invokes a setter above -- `hasUpdated` is still
  // `false` at that point (it only flips after this first update fully completes).
  private _resolvingPendingInitialSelection = false;
  // Set once the `defaultValue` *property* (as opposed to the `default-value` *attribute*, which
  // `hasAttribute('default-value')` already detects) has been explicitly written. Without this,
  // `collectOptions()`'s first pass and `refreshOptionDefaults()` -- both of which capture
  // `_defaultSelected` from declarative `<lr-option selected>`/`defaultSelected` markup whenever
  // `default-value` is absent -- run on every option connecting and silently discard an explicit
  // `.defaultValue = …` property write the instant the *next* option connects, since neither one
  // has any other way to know the default was already set programmatically.
  private _defaultValueDirty = false;
  // Standard listbox type-ahead: printable keystrokes accumulate into this
  // buffer and reset ~500ms after the last one, so "b" then "a" narrows to
  // "ba" instead of restarting the search on every keystroke.
  private typeAheadBuffer = '';
  /** The buffer's reset debounce. Every printable keystroke restarts it, so "b" then "a" narrows
   *  to "ba"; the buffer clears only once the quiet window passes. Scheduled on -- and cancelled
   *  through -- the realm this select lives in at the time, and the realm it was armed in is
   *  re-checked at settle, so a select adopted into another document never clears a buffer that
   *  now belongs to a different realm. Supersession is the controller's own generation guard: a
   *  callback already queued when a newer keystroke restarted the timer arrives inert. */
  private readonly typeAheadReset = new DebounceController<Window>(
    TYPE_AHEAD_RESET_MS,
    (armedIn) => {
      if (!this.isConnected || this.ownerDocument.defaultView !== armedIn) return;
      this.typeAheadBuffer = '';
    },
    () => this.ownerDocument.defaultView,
  );

  /** Focus the internal select trigger. */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.triggerElement?.focus(options);
  }

  /** Blur the internal select trigger. */
  override blur(): void {
    this.triggerElement?.blur();
  }

  /** Activates the internal trigger button -- `HTMLElement.prototype.click()` on a custom
   *  element with no native click semantics of its own is otherwise a no-op, so a generic
   *  form-submit helper or automation script calling `.click()` on the host would silently do
   *  nothing without this forwarding override. Mirrors `<lr-button>`'s identical `click()`. */
  override click(): void {
    if (!this.effectiveDisabled) this.triggerElement?.click();
  }

  // Hand-written accessor (mirrors the `value` accessor below, and the
  // `FormAssociated.name` in `../../internal/form-associated.ts`): a
  // form-associated custom element's submitted entry name is resolved by the
  // browser from the live `name` *content attribute*, read synchronously at
  // FormData-construction/submit time (see `syncFormValue()` below) -- Lit's
  // async (microtask-deferred) `reflect: true` alone would leave a
  // property-only assignment like `el.name = 'b'` invisible to a same-tick
  // `new FormData(form)`/submit, so the attribute write happens here instead.
  private _name = '';
  // `noAccessor` hand-rolled accessor (mirrors `name`/`multiple` above): the cap feeds a
  // `slice()` on every render, so a NaN/negative value must never reach it -- sanitized
  // synchronously here via `finiteCount` rather than left for Lit's default async field setter
  // to hand through unchecked.
  private _maxOptionsVisible = 3;

  constructor() {
    super();
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init)
    );
    // Interactive validation (a submission attempt, `reportValidity()`) is interaction, exactly
    // like picking an option or a blur; `checkValidity()`'s own call below runs inside
    // `withStaticValidityCheck()` so this listener can tell the silent query apart from every
    // other path that raises the same `invalid` event.
    installInteractionOnInvalid(this, this.markInteracted);
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(
      this,
      this.internals,
      () => this[VALIDITY_ANCHOR]()
    );
    installCustomErrorProperty(
      this,
      () => this.validityController.customValidityMessage
    );
    this.syncFormValue();
  }

  /** Browser-resolved form owner. Assigning a form id string or form element updates the `form`
   * content attribute while reads remain element-valued.
   * @attr form ID of an external form owner.
   * @default null */
  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the browser-resolved form owner, including an external owner selected by `form`. */
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="trigger"]') ?? null;
  }

  private localDescriptionIds = '';
  private externalDescriptionLease?: NativeControlDescriptionLease;

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const target = this.renderRoot.querySelector<HTMLElement>('[part="trigger"]');
    if (!target) return;
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(target);
    else this.externalDescriptionLease = acquireNativeControlDescription(this, target, () => this.localDescriptionIds);
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncExternalDescription();
    this.updateValidity();
    if (this.hasUpdated && this.open)
      queueMicrotask(() => this.reconnectOpenPopup());
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    // Re-apply a `value`/`defaultValue`/`selectedOptions` assignment that landed before this first
    // update, now that `multiple` has settled for this update -- see each pending field's own doc.
    if (
      this._isFirstUpdate &&
      (this._pendingInitialDefaultValue !== undefined ||
        this._pendingInitialValue !== undefined ||
        this._pendingInitialSelectedOptions !== undefined)
    ) {
      this._resolvingPendingInitialSelection = true;
      try {
        if (this._pendingInitialDefaultValue !== undefined) {
          const pending = this._pendingInitialDefaultValue;
          this._pendingInitialDefaultValue = undefined;
          this.assignDefaultValue(pending);
        }
        if (this._pendingInitialValue !== undefined) {
          const pending = this._pendingInitialValue;
          this._pendingInitialValue = undefined;
          this.assignValue(pending);
        }
        if (this._pendingInitialSelectedOptions !== undefined) {
          const pending = this._pendingInitialSelectedOptions;
          this._pendingInitialSelectedOptions = undefined;
          this.selectedOptions = pending;
        }
      } finally {
        this._resolvingPendingInitialSelection = false;
      }
    }
    this.announceOpenTransition(changed);
    if (changed.has('open') && !this.open && !this.openVetoed) {
      // The veto has already run synchronously. Clear only for an accepted close, so a vetoed
      // listbox retains its active descendant for assistive technology and Enter.
      this.setActiveIndex(-1);
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed); // no-op in LyraElement/ReactiveElement today, but a future
    // mixin's firstUpdated() layered under this class must still run.
    // happy-dom (through at least 20.14.5) never fires the default slot's INITIAL `slotchange` --
    // see `collectInitialSlotAssignment`'s own doc -- so an <lr-select> whose <lr-option> children
    // already exist at connect (the ordinary "render once data is ready" Lit pattern) would
    // otherwise render zero options under it. Collect once here too, from the slot's current
    // assignment; `collectOptionsFromSlot()` is idempotent (identity-diffed against the previous
    // option set), so a real browser firing the initial event as well contributes no duplicate
    // selection-seeding side effect. Skipped when nothing is assigned yet: an empty result has no
    // default to seed, and capturing now would flip `_defaultCaptured` before options appended
    // later through a genuine `slotchange` get their normal first-pass handling.
    // Deferred a microtask, mirroring `adoptedCallback()`'s own `queueMicrotask` above: `options`
    // is reactive, so writing it (and any selection it seeds) synchronously inside `firstUpdated()`
    // -- after this same update has already been marked complete -- trips Lit's "scheduled an
    // update after an update completed" dev warning. A real `slotchange` event runs this same
    // collection from a task/microtask entirely outside the update cycle, which never trips it;
    // queuing a microtask here reproduces that same "outside the cycle" timing instead of writing
    // `options` from inside it. Still guaranteed to land before any caller's own
    // `await el.updateComplete` continuation: that continuation is queued only once this update's
    // promise resolves, later in this same synchronous turn, so it always joins the microtask queue
    // behind the one queued here.
    const slot = this.optionsSlot;
    queueMicrotask(() => {
      collectInitialSlotAssignment(slot, (s) => {
        if (s.assignedElements({ flatten: true }).some(isLyraOptionElement)) {
          this.collectOptionsFromSlot(s);
        }
      });
    });
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    if (this.pendingOpenTransitionStart === undefined)
      this.pendingOpenTransitionStart = old;
    this.openStateGeneration++;
    this._open = next;
    this.requestUpdate('open', old);
  }

  /** Enforces a platform policy close without exposing an author veto point. A disabled form
   * control cannot keep an interactive popup open even when an ordinary `lr-hide` listener would
   * cancel a user-requested close. */
  private forceCloseOpenState(): void {
    // A normal close may already have changed `_open` in this task while its willUpdate veto point
    // is still pending. Suppress that exact transition as well, but do not leave a sticky flag on a
    // control that was already settled closed: it could be re-enabled and shown before this batch
    // renders.
    const isClosing = this._open || this.pendingOpenTransitionStart === true;
    this.transitionToken++;
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    if (!this._open) {
      if (isClosing)
        this.suppressedOpenLifecycleGeneration = this.openStateGeneration;
      if (this.hasAttribute('open')) this.removeAttribute('open');
      return;
    }
    this.applyOpenState(false);
    this.suppressedOpenLifecycleGeneration = this.openStateGeneration;
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It lives here rather than in `updated()` because a veto has to be answered *before* anything
   * observable happens: `willUpdate()` still runs ahead of render and attribute reflection, so
   * restoring `open` here leaves the listbox, the reflected attribute and the property agreeing
   * with each other without a visible open-then-close flash. Keeping it on the `open` transition
   * (rather than inside `show()`/`hide()`) preserves the existing rule that the lifecycle fires
   * however `open` changed, including a direct `el.open = true` that bypasses both methods.
   */
  private announceOpenTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (
      !changed.has('open') ||
      this._isFirstUpdate ||
      this.suppressedOpenLifecycleGeneration === this.openStateGeneration
    ) {
      return;
    }
    const name = this.open ? 'lr-show' : 'lr-hide';
    // Removal cannot be vetoed -- the element is already gone -- so the disconnect-driven close
    // is announced without offering a veto nobody could honour.
    if (!this.isConnected) {
      this.emit('lr-hide');
      return;
    }
    if (!this.emit(name, null, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
    // `show()`/`hide()` already registered a waiter for the transition this veto just cancelled;
    // without resolving it their returned promise would never settle.
    this.resolveTransitionWaiters(
      this.open ? 'lr-after-hide' : 'lr-after-show'
    );
  }

  /** Submission name.
   * @default '' */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    // A `multiple` select submits a FormData whose keys are baked in at write time, so the
    // submitted entry has to be rebuilt whenever the name changes -- synchronously, for the same
    // same-tick-submit reason the attribute is written here rather than reflected by Lit.
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Whether several options can be selected at once. Flipping it re-shapes `value` (a string
   *  becomes a `string[]`) and the submitted form entry, so it is normally set once declaratively.
   *  @default false */
  get multiple(): boolean {
    return this._multiple;
  }
  set multiple(next: boolean) {
    const old = this._multiple;
    this._multiple = Boolean(next);
    this.toggleAttribute('multiple', this._multiple);
    // Leaving `multiple` collapses the selection to its first entry, so the single-mode
    // string value and the submitted entry can never disagree with what the trigger shows.
    if (!this._multiple && this._selected.length > 1) {
      this.setSelection(
        this._selected.slice(0, 1),
        this._selectedOptions.slice(0, 1)
      );
    } else {
      this.syncFormValue();
    }
    this.requestUpdate('multiple', old);
  }

  /** Maximum number of selected-value chips shown before the rest collapse behind a localized
   *  "+N" chip (`multiple` only). `0` removes the cap. Sanitized to a finite, non-negative
   *  integer, falling back to `3`.
   *  @default 3 */
  get maxOptionsVisible(): number {
    return this._maxOptionsVisible;
  }
  set maxOptionsVisible(next: number) {
    const old = this._maxOptionsVisible;
    this._maxOptionsVisible = finiteCount(next, 3);
    this.requestUpdate('maxOptionsVisible', old);
  }

  /** Whether user interaction and form participation are disabled.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.forceCloseOpenState();
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Whether at least one selected option is required for validity.
   * @default false */
  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /** The selected value: a single string outside `multiple` mode (empty when nothing is
   *  selected), a `string[]` inside it.
   *
   *  Assigning `undefined` or `null` clears the selection -- the documented "unset" contract.
   *  Every string, including `''`, is instead a candidate value resolved against the current
   *  `<lr-option>`s: an option may legitimately declare `value=""`, and assigning `''` selects it
   *  when present (mirroring what clicking that row already did). A `''`/non-array assignment that
   *  matches no option still commits, exactly like any other unmatched string -- see
   *  `isUnknownValue()`.
   *
   *  `LyraPickerValue<Multiple>` narrows to `string` on a `LyraSelect<false>` and `string[]` on a
   *  `LyraSelect<true>`; the unnarrowed default resolves to the published union below, which is
   *  why the manifest type is pinned here rather than left to the inferred alias name.
   *  @type {string | string[]} */
  get value(): LyraPickerValue<Multiple> {
    return (
      this.multiple ? [...this._selected] : this._selected[0] ?? ''
    ) as LyraPickerValue<Multiple>;
  }
  set value(next: LyraPickerValue<Multiple> | null | undefined) {
    if (!this.hasUpdated && !this._resolvingPendingInitialSelection) this._pendingInitialValue = next;
    this._restoredStateActive = false;
    this._valueDirty = true;
    const values = normalizeSelectionValues(next);
    this.setSelection(
      values,
      values.map((value) =>
        this.options.find((option) => option.value === value)
      )
    );
  }

  /** Reset value, matching the mapped native-like select contract. The `default-value` attribute
   * supplies the single-mode string form; property writes may use a string array in `multiple`
   * mode. Changing the default updates the live value only while it is still pristine.
   * `undefined`/`null` clear the default; `''` is a candidate value like any other -- see the
   * `value` setter's doc for the full contract.
   * @default ''
   * @type {string | string[]} */
  get defaultValue(): LyraPickerValue<Multiple> {
    return (
      this.multiple ? [...this._defaultSelected] : this._defaultSelected[0] ?? ''
    ) as LyraPickerValue<Multiple>;
  }
  set defaultValue(next: LyraPickerValue<Multiple> | null | undefined) {
    if (!this.hasUpdated && !this._resolvingPendingInitialSelection) this._pendingInitialDefaultValue = next;
    this._defaultValueDirty = true;
    const old = this.multiple
      ? [...this._defaultSelected]
      : this._defaultSelected[0] ?? '';
    const values = normalizeSelectionValues(next);
    this._defaultSelected = this.multiple ? [...values] : values.slice(0, 1);
    this._defaultSelectedOptions = this.resolveOccurrences(
      this._defaultSelected
    );
    if (!this._valueDirty && !this._restoredStateActive) {
      this.setSelection(
        [...this._defaultSelected],
        [...this._defaultSelectedOptions]
      );
    }
    this.requestUpdate('defaultValue', old);
  }

  /** Live selected option occurrences. Writes commit the referenced live options through the
   * same event-silent path as a `value` assignment; foreign/detached options are ignored and
   * single mode keeps only the first occurrence. Reads return a fresh snapshot, so mutating the
   * returned array never mutates the control's identity bookkeeping.
   * @default [] */
  get selectedOptions(): LyraOption[] {
    return [...this._selectedOptions];
  }
  set selectedOptions(next: LyraOption[]) {
    if (!this.hasUpdated && !this._resolvingPendingInitialSelection) this._pendingInitialSelectedOptions = next;
    this._restoredStateActive = false;
    this._valueDirty = true;
    const candidates = Array.isArray(next) ? next : [];
    const live = candidates.filter(
      (option, index): option is LyraOption =>
        isLyraOptionElement(option) &&
        this.contains(option) &&
        this.options.includes(option) &&
        candidates.indexOf(option) === index
    );
    const selected = this.multiple ? live : live.slice(0, 1);
    this.setSelection(
      selected.map((option) => option.value),
      selected
    );
  }

  /** The opaque `data` payload of each committed value, index-aligned with `value` -- always an
   * array the same length as `value`, in both single and `multiple` mode. A committed value with
   * no currently live matching option -- see `isUnknownValue()` -- fills its own slot with
   * `undefined` rather than shifting the entries after it, so `selectedData[i]` always describes
   * `(this.multiple ? this.value[i] : this.value)`. Reached by reference, never deep-cloned: the
   * light-DOM counterpart to an async combobox source row's own `data` field, surfaced through
   * `selectedRows`.
   * @default [] */
  get selectedData(): readonly unknown[] {
    return this.resolveOccurrenceSlots(this._selected, this._selectedOptions).map(
      (option) => option?.data
    );
  }

  /**
   * The single write path for the committed selection. `preferred` carries the exact
   * `<lr-option>` occurrences a caller already resolved (a click routes to the row that was
   * actually pressed, not to the first row sharing its value); anything missing is resolved by
   * value against the current option list.
   */
  private setSelection(
    next: string[],
    preferred: Array<LyraOption | undefined> = []
  ): void {
    // Multiple-selection identity is occurrence-based. Preserve duplicate strings so two distinct
    // same-valued options survive through value, tags, restoration and FormData.
    const values = this.multiple ? [...next] : next.slice(0, 1);
    const previousValues = this._selected;
    const previousOptions = this._selectedOptions;
    const old = this.multiple ? [...previousValues] : previousValues[0] ?? '';
    this._selected = values;
    this._selectedOptions = this.resolveOccurrences(values, preferred);
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
    // A different occurrence can carry the same public value. Lit's normal
    // value change detection is intentionally silent for same-string writes,
    // so schedule the occurrence-only render explicitly.
    const sameValues =
      previousValues.length === values.length &&
      previousValues.every((value, i) => value === values[i]);
    const sameOptions =
      previousOptions.length === this._selectedOptions.length &&
      previousOptions.every((option, i) => option === this._selectedOptions[i]);
    if (sameValues && !sameOptions) this.requestUpdate();
  }

  /** Maps each selected value onto one live `<lr-option>`, honouring a caller-supplied
   *  occurrence when it is still slotted and never handing the same element to two values. */
  private resolveOccurrences(
    values: string[],
    preferred: Array<LyraOption | undefined> = []
  ): LyraOption[] {
    return this.resolveOccurrenceSlots(values, preferred).filter(
      (option): option is LyraOption => option !== undefined
    );
  }

  /** Same resolution as `resolveOccurrences()`, but keeps one slot per `values` entry --
   *  `undefined` where nothing resolves -- so a caller needing index alignment with `values`
   *  (e.g. `selectedData`) never has to guess which value a dropped occurrence belonged to. */
  private resolveOccurrenceSlots(
    values: string[],
    preferred: Array<LyraOption | undefined> = []
  ): Array<LyraOption | undefined> {
    const claimed = new Set<LyraOption>();
    return values.map((value, index) => {
      const hint = preferred.length === values.length
        ? preferred[index]
        : preferred.find((option) => option?.value === value && !claimed.has(option));
      const match =
        hint &&
        hint.value === value &&
        this.options.includes(hint) &&
        !claimed.has(hint)
          ? hint
          : this.options.find(
              (option) => option.value === value && !claimed.has(option)
            );
      if (!match) return undefined;
      claimed.add(match);
      return match;
    });
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled `<select>` --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
      // selects, and with it the documented `:state(user-invalid)` error styling.
      this.validityController.setValidity({});
    } else if (this.required && this._selected.length === 0) {
      this.validityController.setValidity(
        { valueMissing: true },
        this.localize('selectValueMissing')
      );
    } else {
      this.validityController.setValidity({});
    }
    this.reflectValidityStates();
  }

  /** Republishes the six validity custom states (`required`/`optional`, `valid`/`invalid`,
   *  `user-valid`/`user-invalid`) from whatever `ElementInternals` currently holds. Called from
   *  every path that can move either validity or the interaction flag. */
  private reflectValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
    if (this._selected.length === 0) this.internals.states?.add('blank');
    else this.internals.states?.delete('blank');
  }

  private syncFormValue(): void {
    if (!this.multiple) {
      // One argument, so the restorable state stays the submitted string itself -- what
      // `formStateRestoreCallback` below reads back for a single-select.
      this.internals.setFormValue(this._selected[0] ?? '');
      return;
    }
    // A FormData form value submits under the keys baked into the FormData itself, bypassing the
    // element's own `name` the way a plain string value would use it -- so an unnamed multi-select
    // must contribute nothing (matching a nameless native `<select multiple>`) rather than
    // inventing a shared key that would merge with any other unnamed select in the same form.
    const state = JSON.stringify(this._selected);
    if (!this.name) {
      this.internals.setFormValue(null, state);
      return;
    }
    const data = new FormData();
    for (const value of this._selected) data.append(this.name, value);
    this.internals.setFormValue(data, state);
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  formResetCallback(): void {
    this.touched = false;
    this.hasInteracted = false;
    this._restoredStateActive = false;
    this._valueDirty = false;
    const resetOptions =
      this._defaultSelectedOptions.length > 0
        ? this._defaultSelectedOptions
        : this.options.filter((option) => wasOptionInitiallySelected(option));
    if (this._defaultSelectedOptions.length === 0 && resetOptions.length > 0) {
      this._defaultSelectedOptions = [...resetOptions];
      this._defaultSelected = resetOptions.map((option) => option.value);
    }
    const defaults = new Set(resetOptions);
    for (const option of this.options) {
      option[RESET_OPTION_SELECTED_FROM_OWNER](defaults.has(option));
    }
    this.setSelection(
      [...this._defaultSelected],
      [...this._defaultSelectedOptions]
    );
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    // Single-select persists the submitted string itself; `multiple` persists a JSON array,
    // since its own form value is a FormData whose entries the platform never hands back here.
    if (!this.multiple) {
      // No persisted state (`null`) means "nothing was ever submitted" -- an explicit clear, not
      // an attempt to select an option whose value happens to be `''`.
      this.assignValue(typeof state === 'string' ? state : undefined);
    } else {
      let restored: string[] = [];
      if (typeof state === 'string') {
        try {
          const parsed: unknown = JSON.parse(state);
          if (
            Array.isArray(parsed) &&
            parsed.every((entry) => typeof entry === 'string')
          )
            restored = parsed;
        } catch {
          // Malformed persisted state restores an empty selection.
        }
      }
      this.assignValue(restored);
    }
    this._restoredStateActive = true;
    this._valueDirty = true;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.forceCloseOpenState();
    this.updateValidity();
    this.requestUpdate();
  }
  private markInteracted = (): void => {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    this.reflectValidityStates();
  };

  checkValidity(): boolean {
    this.updateValidity();
    // Silent query: must never mark a pristine control as interacted, however invalid it already
    // is. `withStaticValidityCheck()` tells the `installInteractionOnInvalid()` listener above
    // that whatever `invalid` event fires synchronously inside this call is this call, not a
    // submission attempt.
    return withStaticValidityCheck(this, () => this.internals.checkValidity());
  }
  reportValidity(): boolean {
    this.updateValidity();
    // Marked explicitly rather than left to the `installInteractionOnInvalid()` listener: that
    // listener only fires when the check actually fails, but a `reportValidity()` call on an
    // already-valid control still counts as interaction (native `:user-valid` matches on it too).
    // A submission attempt reaches the same listener without ever calling this method at all --
    // it drives `ElementInternals` directly. `checkValidity()` deliberately marks neither path:
    // it is the silent query, and wraps its own call in `withStaticValidityCheck()` accordingly.
    this.hasInteracted = true;
    this.reflectValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that option is no longer available"). A non-empty
   * `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` select with nothing chosen stays `valueMissing`. The custom error also survives
   * every intrinsic recomputation in between (each selection/`required` change re-runs
   * `updateValidity()`) and a `form.reset()` — matching a native control, where only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.reflectValidityStates();
  }

  /** Clears consumer-supplied validity and restores the current required/selection constraint. */
  resetValidity(): void {
    this.setCustomValidity('');
  }

  override disconnectedCallback(): void {
    this.releaseExternalDescription();
    this.transitionToken++;
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.clearTypeAheadTimer();
    this.typeAheadBuffer = '';
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseExternalDescription();
    if (this.hasUpdated) this.syncExternalDescription();
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.clearTypeAheadTimer();
    queueMicrotask(() => this.reconnectOpenPopup());
  }

  private collectOptions = (e: Event): void => {
    this.collectOptionsFromSlot(e.target as HTMLSlotElement);
  };

  /**
   * Reads the default slot's currently assigned `<lr-option>` elements and applies them --
   * wired as the `slotchange` handler (via `collectOptions`) for every later mutation, and called
   * once more from `firstUpdated()` (see `collectInitialSlotAssignment`) to cover an environment,
   * or a real-browser timing race, where the slot's initial assignment never fires `slotchange`.
   * Idempotent over an unchanged assigned-element set: `previous` below is an identity set of the
   * options already applied, so a second call that reads back the same elements finds nothing new
   * to seed and falls through to the harmless `reflectSelected()` re-sync at the end.
   */
  private collectOptionsFromSlot(slot: HTMLSlotElement): void {
    const previous = new Set(this.options);
    const previousActive = this.activeOption;
    const previousActiveRawIndex = previousActive
      ? this.options.indexOf(previousActive)
      : this.activeIndex;
    this.options = slot
      .assignedElements({ flatten: true })
      .filter(isLyraOptionElement);
    // The option set (or an option's own adornment children) may have changed wholesale; re-clone
    // lazily on the next render rather than serving a stale adornment -- mirrors lr-combobox.
    this.adornmentClones = new WeakMap();
    this.reconcileActiveOption(previousActive, previousActiveRawIndex);
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      // Seed the initial selection -- and the reset default -- from
      // declarative `<lr-option selected>` markup, mirroring native
      // `<select><option selected>`. Only the *first* declared-selected
      // option matters outside `multiple` mode when several declare it,
      // mirroring lr-combobox's single-mode behavior. This is the only place
      // `_defaultSelected` is set; picking an option later (the `value`
      // setter) never redefines the reset default.
      const hasDefaultValue = this.hasAttribute('default-value');
      // An explicitly-written `defaultValue` *property* is just as authoritative as the
      // `default-value` *attribute* -- see `_defaultValueDirty`'s own doc.
      const explicitDefault = hasDefaultValue || this._defaultValueDirty;
      const allDefaults = this.options.filter(
        (option) => option.defaultSelected
      );
      const defaults = this.multiple ? allDefaults : allDefaults.slice(0, 1);
      const allLive = this.options.filter((option) => option.selected);
      const live = this.multiple ? allLive : allLive.slice(0, 1);
      const initialLive = this.options.filter((option) =>
        wasOptionInitiallySelected(option)
      );
      const optionDirty = this.options.some((option) =>
        isOptionSelectedDirty(option)
      );
      const dirtySelected = this.options.filter(
        (option) => isOptionSelectedDirty(option) && option.selected
      );
      if (!explicitDefault) {
        const resetOptions =
          defaults.length > 0
            ? defaults
            : initialLive.length > 0
            ? initialLive
            : live;
        this._defaultSelected = resetOptions.map((option) => option.value);
        this._defaultSelectedOptions = [...resetOptions];
      } else {
        this._defaultSelectedOptions = this.resolveOccurrences(
          this._defaultSelected
        );
      }
      const fromDefaults = explicitDefault || defaults.length > 0;
      const initial = optionDirty
        ? this.multiple
          ? allLive
          : dirtySelected.slice(-1)[0]
          ? dirtySelected.slice(-1)
          : live
        : explicitDefault
        ? this._defaultSelectedOptions
        : fromDefaults
        ? defaults
        : live;
      if (
        initial.length > 0 &&
        !this._restoredStateActive &&
        !this._valueDirty
      ) {
        if (!fromDefaults || optionDirty) this._valueDirty = true;
        this.setSelection(
          initial.map((option) => option.value),
          [...initial]
        );
        return; // setSelection() already called reflectSelected()
      }
      if (optionDirty) this._valueDirty = true;
      if (explicitDefault && !this._valueDirty && !this._restoredStateActive) {
        this.setSelection(
          [...this._defaultSelected],
          [...this._defaultSelectedOptions]
        );
        return;
      }
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed the newest one
      // (all of them, in `multiple` mode) into the live selection instead of
      // letting reflectSelected() below strip the `selected` attribute back off.
      const newDefaults = this.options.filter(
        (option) => !previous.has(option) && option.defaultSelected
      );
      const newLive = this.options.filter(
        (option) =>
          !previous.has(option) && option.selected && !option.defaultSelected
      );
      this.refreshOptionDefaults();
      const eligible = [
        ...(!this._restoredStateActive && !this._valueDirty ? newDefaults : []),
        ...(!this._restoredStateActive ? newLive : []),
      ];
      if (eligible.length > 0) {
        const added = this.multiple ? eligible : eligible.slice(-1);
        const occurrences = this.multiple
          ? [...new Set([...this._selectedOptions, ...added])]
          : added;
        if (newLive.length > 0) this._valueDirty = true;
        this.setSelection(
          occurrences.map((option) => option.value),
          occurrences
        );
        return; // setSelection() already called reflectSelected()
      }
    }
    this.reflectSelected();
  }

  private refreshOptionDefaults(): void {
    if (this.hasAttribute('default-value') || this._defaultValueDirty) return;
    const declared = this.options.filter((option) => option.defaultSelected);
    const defaults = this.multiple ? declared : declared.slice(0, 1);
    this._defaultSelected = defaults.map((option) => option.value);
    this._defaultSelectedOptions = [...defaults];
    if (!this._valueDirty && !this._restoredStateActive) {
      this.setSelection(
        [...this._defaultSelected],
        [...this._defaultSelectedOptions]
      );
    }
  }

  private reflectSelected(): void {
    // Re-resolve first: an option list that changed under us (slotchange, a removed row) can
    // leave a stale element behind, and the light-DOM `selected` reflection below has to follow
    // whatever is actually slotted now.
    this._selectedOptions = this.resolveOccurrences(
      this._selected,
      this._selectedOptions
    );
    this._selectedValuesByOption = new Map(
      this._selectedOptions.map((option) => [option, option.value])
    );
    const chosen = new Set(this._selectedOptions);
    for (const option of this.options) {
      option[SET_OPTION_SELECTED_FROM_OWNER](chosen.has(option));
    }
  }

  /**
   * Commits (or, in `multiple` mode, toggles off) a value that no option claims, from its own
   * synthetic listbox row. In single mode the value is already the selection, so this is the
   * documented re-pick case: `lr-activate` fires, `change`/`input` deliberately do not.
   */
  private selectUnknownValue(value: string): void {
    this.hasInteracted = true;
    this._restoredStateActive = false;
    this._valueDirty = true;
    if (this.multiple) {
      const index = this._selected.indexOf(value);
      const values =
        index >= 0
          ? this._selected.filter((_, position) => position !== index)
          : [...this._selected, value];
      this.setSelection(values, this.resolveOccurrences(values, this._selectedOptions));
      this.emitValueEvents();
      this.emit('lr-activate', { value });
      return;
    }
    void this.hide();
    this.emit('lr-activate', { value });
  }

  /** The matched label for one committed value, or `undefined` when no live option currently
   *  declares it -- the shared lookup behind both `labelFor()` and `isUnknownValue()`. */
  private resolvedLabelFor(value: string, occurrenceIndex = 0): string | undefined {
    return (
      (this._selectedOptions[occurrenceIndex]?.value === value
        ? this._selectedOptions[occurrenceIndex]?.label
        : undefined) ??
      this._selectedOptions.find((option) => option.value === value)?.label ??
      this.options.find((option) => option.value === value)?.label
    );
  }

  /** The label to show for one committed value: the selected occurrence's own label, else any
   *  option sharing that value, else -- while `loading` -- the localized loading placeholder, else
   *  the raw value (a programmatic write with no matching row). */
  private labelFor(value: string, occurrenceIndex = 0): string {
    const resolved = this.resolvedLabelFor(value, occurrenceIndex);
    if (resolved !== undefined) return resolved;
    // Not yet known whether this value is genuinely unmatched or its catalog just hasn't mounted
    // yet -- see isUnknownValue(). getUnknownLabel is reserved for a value already known to be
    // unmatched, exactly like the raw-value fallback below it.
    if (this.loading) return this.localize('loading');
    // Unmatched only, so the hook can never override a real option's own label. `getTag` cannot
    // serve this case -- it is handed a matched option, which by definition does not exist here.
    const override = this.getUnknownLabel?.(value);
    return override !== undefined && override.trim().length > 0 ? override : value;
  }

  /** Whether a committed value matches no currently-slotted `<lr-option>` -- a stale value from
   *  before an option was removed, or a programmatic `value`/`defaultValue` assignment that never
   *  matched anything. Drives the dashed/italic "not in catalog" presentation in `render()`, so a
   *  genuinely unresolved value never leaks its raw string with no explanation, while
   *  `resolvedLabelFor()` keeps the raw value itself fully reachable through `labelFor()`/`value`.
   *
   *  Suppressed entirely while `loading` is `true`: an unresolved value in that window simply
   *  hasn't had its matching `<lr-option>` mount yet, which is "not yet known", not "genuinely
   *  unknown" -- see `labelFor()`'s own loading-placeholder fallback, which this has to agree with
   *  so the trigger/tag text and the "not in catalog" badge are never shown at the same time. */
  private isUnknownValue(value: string, occurrenceIndex = 0): boolean {
    if (this.loading) return false;
    return this.resolvedLabelFor(value, occurrenceIndex) === undefined;
  }

  /**
   * The sole available option, when `autoCommitSingleOption` is set and
   * there's exactly one. Opening a one-row popup to pick the only available choice is pure
   * friction with no real decision behind it, so an opted-in single-option select skips the
   * popup entirely -- see `onTriggerClick`/`onKeyDown`, which commit this option directly on
   * activation instead of opening the listbox, and `render()`, which drops the popup-trigger
   * ARIA semantics (`role="combobox"`, `aria-haspopup`, `aria-expanded`, the chevron) in favor
   * of a plain button's, since no popup can ever appear while this getter returns a value.
   * Returns `undefined` whenever `autoCommitSingleOption` is `false` (the default), regardless
   * of option count, so the normal combobox trigger renders unconditionally. Does not affect
   * `value`/validity defaults in any way -- an unselected single-option select stays unselected
   * until the trigger is actually activated, exactly like the multi-option case.
   */
  private get onlyOption(): LyraOption | undefined {
    if (!this.autoCommitSingleOption) return undefined;
    // Authored options only: a synthetic unmatched-value row is not a choice the author offered,
    // so it must never turn a one-option select into a two-option one (or vice versa).
    const navigable = this.navigableOptions(this.options);
    return navigable.length === 1 ? navigable[0] : undefined;
  }

  /**
   * The options arrow keys, type-ahead and the active-descendant index may land on. `inert` counts
   * alongside `disabled` for the same reason it does in `<lr-menu>`'s `isNavigable()`: an inert
   * element refuses interaction outright, so an active index pointing at one describes a row the
   * user can neither reach nor commit. `closest('[inert]')` covers an inert ancestor, which inerts
   * the option just as completely as the attribute on the option itself. The severity is lower here
   * than in a menu -- this listbox keeps DOM focus on the trigger and moves only
   * `aria-activedescendant` -- but the predicate has to agree across all four call sites or the
   * rendered `data-active` row and the committed option can disagree.
   */
  private isOptionAvailable(option: LyraOption): boolean {
    return !option.disabled && !option.inert && !option.closest('[inert]');
  }

  private navigableOptions(options: LyraOption[] = this.listboxOptions): LyraOption[] {
    return options.filter((option) => this.isOptionAvailable(option));
  }

  /**
   * Detached `<lr-option>` instances standing in for committed values no slotted option claims,
   * keyed by value and rebuilt only when that set changes.
   *
   * Real elements rather than a parallel row shape, because everything that drives this listbox --
   * `navigableOptions()`, the roving `activeIndex`, type-ahead, `renderRows()` and the delegated
   * click path -- is written against `LyraOption`. Giving the synthetic row the same type is what
   * makes it keyboard-reachable for free instead of a pointer-only decoration.
   *
   * They are deliberately NOT in `this.options`: that array is the authored option set, and
   * `resolveOccurrences()` resolves `selectedOptions` out of it. Adding them there would make the
   * unmatched value resolve to an option, which is precisely the condition this feature exists to
   * report, and would leak a component-owned element through the public `selectedOptions`.
   */
  private unknownOptionCache = new Map<string, LyraOption>();

  private get unknownValues(): string[] {
    if (!this.showUnknownOption) return [];
    return this._selected.filter((value, index) => this.isUnknownValue(value, index));
  }

  private get unknownOptions(): LyraOption[] {
    const values = this.unknownValues;
    if (values.length === 0) {
      this.unknownOptionCache.clear();
      return [];
    }
    for (const key of [...this.unknownOptionCache.keys()]) {
      if (!values.includes(key)) this.unknownOptionCache.delete(key);
    }
    return values.map((value) => {
      let option = this.unknownOptionCache.get(value);
      if (!option) {
        // createElement (never createElementNS): a namespaced custom element never upgrades.
        option = this.ownerDocument.createElement(tag('option')) as LyraOption;
        this.unknownOptionCache.set(value, option);
      }
      option.value = value;
      option.label = this.labelFor(value);
      return option;
    });
  }

  /** The option set the listbox renders and navigates: the authored options plus any synthetic
   *  unmatched-value rows. */
  private get listboxOptions(): LyraOption[] {
    const unknown = this.unknownOptions;
    return unknown.length === 0 ? this.options : [...this.options, ...unknown];
  }

  /** Updates the numeric active-descendant cursor and its stable option identity together. */
  private setActiveIndex(
    next: number,
    navigable: LyraOption[] = this.navigableOptions()
  ): void {
    if (next < 0 || navigable.length === 0) {
      this.activeIndex = -1;
      this.activeOption = undefined;
      return;
    }
    const index = Math.min(next, navigable.length - 1);
    this.activeIndex = index;
    this.activeOption = navigable[index];
  }

  /** Keeps the active option by identity when possible. If it disappeared or became unavailable,
   *  choose the nearest navigable row around its former raw collection position, preferring the
   *  following row on an equal-distance tie, then fall back to no active descendant. */
  private reconcileActiveOption(
    previousActive: LyraOption | undefined,
    previousRawIndex: number
  ): void {
    if (!previousActive && this.activeIndex < 0) return;
    const navigable = this.navigableOptions();
    if (previousActive) {
      const preservedIndex = navigable.indexOf(previousActive);
      if (preservedIndex >= 0) {
        this.setActiveIndex(preservedIndex, navigable);
        return;
      }
    }
    if (navigable.length === 0) {
      this.setActiveIndex(-1, navigable);
      return;
    }
    const pivot = Math.max(0, previousRawIndex);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestRawIndex = -1;
    navigable.forEach((option, index) => {
      const rawIndex = this.listboxOptions.indexOf(option);
      const distance = Math.abs(rawIndex - pivot);
      if (
        distance < nearestDistance ||
        (distance === nearestDistance &&
          rawIndex >= pivot &&
          nearestRawIndex < pivot)
      ) {
        nearestIndex = index;
        nearestDistance = distance;
        nearestRawIndex = rawIndex;
      }
    });
    this.setActiveIndex(nearestIndex, navigable);
  }

  // Fired by `option.ts`'s `lr-option-change` (a MutationObserver on the
  // option's own light-DOM content/attributes) when an already-slotted
  // `<lr-option>` mutates its own data in place -- `collectOptions()` only
  // re-runs on `slotchange`, which never fires for such a mutation, so
  // without this the rendered listbox row would go stale. Reassigning (not
  // mutating) `options` gives Lit a new array reference to diff against.
  //
  // The notification is sealed here rather than allowed to keep bubbling: it
  // is a private child-to-parent refresh signal, not part of this component's
  // event contract, and it carries the *option's* target/detail rather than
  // the select's. Left uncontained it escapes the host and reaches consumer
  // code as an undocumented, undiscoverable event; a consumer who needs to
  // know the value moved already has `lr-change`/`lr-input`. A listener bound
  // directly to the `<lr-option>` still sees it -- the option is the event
  // target, and the target's own listeners run before this slot listener.
  private onOptionChange = (e: Event): void => {
    e.stopPropagation();
    const option = e.composedPath().find(isLyraOptionElement);
    if (isLyraOptionElement(option) && this.options.includes(option) && isOptionSelectedWrite(e)) {
      this._valueDirty = true;
      this._restoredStateActive = false;
      const selected = this._selectedOptions.includes(option);
      if (option.selected === selected &&
          (!selected || this._selectedValuesByOption.get(option) === option.value)) return;
      if (option.selected && !this.multiple) {
        this.setSelection([option.value], [option]);
        return;
      }
      // Keep unmatched committed values in place and align each mounted occurrence with its
      // own value entry before changing that occurrence. selectedOptions alone omits unmatched
      // values and cannot reconstruct the full committed selection.
      const remaining = [...this._selectedOptions];
      const preferred = this._selected.map((value) => {
        const index = remaining.findIndex((candidate) => this._selectedValuesByOption.get(candidate) === value);
        return index < 0 ? undefined : remaining.splice(index, 1)[0];
      });
      const values = [...this._selected];
      const index = preferred.indexOf(option);
      if (option.selected) {
        if (index < 0) {
          values.push(option.value);
          preferred.push(option);
        } else {
          values[index] = option.value;
        }
      } else {
        if (index < 0) return;
        values.splice(index, 1);
        preferred.splice(index, 1);
      }
      this.setSelection(values, preferred);
      return;
    }
    if (isLyraOptionElement(option) &&
        this.adornmentClones.get(option)?.markup !== this.adornmentMarkup(option)) {
      this.adornmentClones.delete(option);
    }
    const previousActive = this.activeOption;
    const previousActiveRawIndex = previousActive
      ? this.options.indexOf(previousActive)
      : this.activeIndex;
    queueMicrotask(() => {
      this.refreshOptionDefaults();
      this.reflectSelected();
      this.options = [...this.options];
      this.reconcileActiveOption(previousActive, previousActiveRawIndex);
    });
  };

  /** Opens the listbox and resolves after `lr-after-show`. */
  show(): Promise<void> {
    if (this.open || this.effectiveDisabled) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-hide');
    const settled = this.waitForTransition('lr-after-show');
    this.open = true;
    return settled;
  }
  /** Closes the listbox and resolves after `lr-after-hide`. */
  hide(): Promise<void> {
    if (!this.open) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-show');
    const settled = this.waitForTransition('lr-after-hide');
    this.open = false;
    return settled;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (e.composedPath().includes(this)) return;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.dismissBackdrop();
      return;
    }
    this.restoreFocusOnClose = false;
    void this.hide();
  };

  private positionListbox(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = this.effectiveDirection;
    const anchor = this.renderRoot.querySelector(
      '[part="trigger"]'
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector(
      '[part="listbox"]'
    ) as HTMLElement | null;
    if (!anchor || !listbox) return;
    this.cleanup = place(anchor, listbox, {
      placement: rtlAwarePlacement(this.placement, this),
      strategy: resolveEffectivePositioningStrategy(this, this._positioningStrategy, 'absolute'),
      sync: this.sync,
    });
    this.positioningReady = this.cleanup.ready;
  }

  private activateListboxOverlay(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.restoreFocusOnClose = true;
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () =>
        this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      onBackdrop: () => {
        this.restoreFocusOnClose = false;
        void this.hide();
      },
      restoreFocusTo: this.triggerElement ?? null,
    });
    this.bindDocumentPointer();
    this.positionListbox();
  }

  private teardownListboxOverlay(
    restoreFocus = this.restoreFocusOnClose
  ): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.positionedDirection = undefined;
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.restoreFocusOnClose = true;
  }

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener)
      return;
    this.unbindDocumentPointer();
    const listener = (event: PointerEvent): void => {
      if (
        this.pointerListener !== listener ||
        this.pointerListenerDocument !== ownerDocument ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onDocPointer(event);
    };
    this.pointerListenerDocument = ownerDocument;
    this.pointerListener = listener;
    ownerDocument.addEventListener('pointerdown', listener, true);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener(
        'pointerdown',
        this.pointerListener,
        true
      );
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private reconnectOpenPopup(): void {
    if (!this.isConnected || !this.open) return;
    this.activateListboxOverlay();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    this.syncExternalDescription();
    const suppressOpenLifecycle =
      changed.has('open') &&
      this.suppressedOpenLifecycleGeneration === this.openStateGeneration;
    const shouldRefreshPosition =
      this.open &&
      this.isConnected &&
      (changed.has('placement') ||
        changed.has('positioningStrategy') ||
        // `sync` is the one placement option that writes inline sizing onto the listbox, so
        // dropping it has to re-run place() -- the positioner releases the width it owns on the
        // next setup, and nothing else would ever clear it.
        changed.has('sync') ||
        this.positionedDirection !== this.effectiveDirection);
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing about the state actually moved: tearing down and rebuilding the popup
    // machinery here would undo the veto it was meant to honour.
    if (changed.has('open') && !this.openVetoed) {
      // All `open`-driven side effects (positioning and the click-outside listener) live here
      // rather than in show()/hide() so they run however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely. The lr-show/lr-hide veto point
      // itself runs one step earlier, in willUpdate().
      if (this.open && this.isConnected) {
        this.activateListboxOverlay();
        // Don't settle a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-select open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate && !suppressOpenLifecycle) {
          void this.settleTransition('lr-after-show');
        }
      } else if (!this.open) {
        this.teardownListboxOverlay();
        if (!this._isFirstUpdate && !suppressOpenLifecycle) {
          void this.settleTransition('lr-after-hide');
        }
      } else {
        this.teardownListboxOverlay(false);
      }
    } else if (changed.has('open') && this.openVetoed) {
      this.restoreFocusOnClose = true;
      if (shouldRefreshPosition) this.positionListbox();
    } else if (shouldRefreshPosition) {
      // Live positioning-option changes update the existing overlay entry in place. Re-registering
      // it would incorrectly promote the select to the top of the stack and refire lifecycle.
      this.positionListbox();
    }
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value')
    ) {
      this.toggleAttribute(
        'data-invalid',
        this.touched && !this.internals.validity.valid
      );
    }
    if (changed.has('open')) {
      this.pendingOpenTransitionStart = undefined;
      this.suppressedOpenLifecycleGeneration = undefined;
    }
  }

  private async settleTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (event === 'lr-after-show') {
      while (this.open) {
        const readiness = this.positioningReady;
        const positioned = await readiness;
        if (this.transitionToken !== token) return;
        if (positioned) break;
        if (readiness === this.positioningReady) {
          this.forceCloseOpenState();
          return;
        }
      }
      await this.updateComplete;
      if (this.transitionToken !== token) return;
    }
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view)
        await new Promise<void>((resolve) =>
          view.requestAnimationFrame(() => resolve())
        );
      if (this.transitionToken !== token) return;
      const listbox = this.renderRoot.querySelector('[part="listbox"]');
      const animations = listbox?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(
        animations.map((animation) => animation.finished.catch(() => undefined))
      );
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
    this.resolveTransitionWaiters(event);
  }

  private waitForTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters =
        this.transitionWaiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.transitionWaiters.set(event, waiters);
    });
  }

  private resolveTransitionWaiters(
    event: 'lr-after-show' | 'lr-after-hide'
  ): void {
    const waiters = this.transitionWaiters.get(event);
    if (!waiters) return;
    this.transitionWaiters.delete(event);
    for (const resolve of waiters) resolve();
  }

  /** Dispatches the native value-change pair and prefixed aliases. `input`/`change` stay deliberately unprefixed -- this
   *  control is a direct `<select>` counterpart, so its value-change events keep `<select>`'s own
   *  naming instead of the `lr-` prefix `<lr-slider>` uses for its analogous rename. See the class
   *  doc's `change` entry for the full rule. The prefixed aliases carry `detail: { value, data }`. */
  private emitValueEvents(): void {
    // Pinned to the un-narrowed class. Inside the class body `Multiple` is an unresolved type
    // parameter, which leaves the detail type an unresolved conditional that no concrete argument
    // list can be checked against -- the same reason `<lr-popover>`'s own lifecycle emits resolve
    // against its base event map. The constraint already guarantees the payload's shape.
    const self = this as unknown as LyraSelect<boolean>;
    const data = this.selectedData;
    dispatchNativeInputEvent(this);
    self.emit('lr-input', { value: self.value, data });
    dispatchNativeEvent(this, 'change');
    self.emit('lr-change', { value: self.value, data });
  }

  /**
   * This component's own channel for writing `value`.
   *
   * The public accessor is narrowed by `Multiple`, and inside the class body that parameter is
   * unresolved -- so no concrete `string` or `string[]` is assignable to it, even though every
   * value written here is one of the two. One documented cast in one place, rather than a dozen at
   * the call sites; the runtime path is the public setter, unchanged.
   */
  private assignValue(next: string | string[] | null | undefined): void {
    this.value = next as LyraPickerValue<Multiple> | null | undefined;
  }

  private assignDefaultValue(next: string | string[] | null | undefined): void {
    this.defaultValue = next as LyraPickerValue<Multiple> | null | undefined;
  }

  private selectOption(option: LyraOption): void {
    if (this.effectiveDisabled || !this.isOptionAvailable(option)) return;
    // A synthetic unmatched-value row never resolves through `resolveOccurrences()`, so the
    // ordinary multi-select path would read it as "not currently selected" and append a DUPLICATE
    // copy of a value that is already committed. Route it by value instead.
    if (this.unknownOptionCache.get(option.value) === option) {
      this.selectUnknownValue(option.value);
      return;
    }
    this.hasInteracted = true;
    this._restoredStateActive = false;
    this._valueDirty = true;
    if (this.multiple) {
      // Picking a selected row again toggles it back off, the standard multi-select listbox
      // contract -- and the listbox stays open, since one pick is rarely the whole intent.
      const selectedIndex = this._selectedOptions.indexOf(option);
      const selected = selectedIndex >= 0;
      const occurrences = selected
        ? this._selectedOptions.filter((_, index) => index !== selectedIndex)
        : [...this._selectedOptions, option];
      const values = selected
        ? this._selected.filter((_, index) => index !== selectedIndex)
        : [...this._selected, option.value];
      this.setSelection(values, occurrences);
      this.emitValueEvents();
      this.emit('lr-activate', { value: option.value });
      return;
    }
    // Reopening the listbox (or, on a single-option select, simply
    // reactivating the trigger) and landing back on the already-selected
    // row is not a selection change -- `change`/`input` are documented as
    // firing when "the selection changed", so only emit them when the
    // value actually moves, matching a native <select> (which never fires
    // `change` for re-picking the currently-selected <option>).
    const changed =
      option !== this._selectedOptions[0] || option.value !== this._selected[0];
    this.setSelection([option.value], [option]);
    void this.hide();
    if (changed) this.emitValueEvents();
    // Every activation of an available row reports, including the re-pick of the current selection
    // that `change`/`lr-change` are defined to stay silent for. See the class doc's `lr-activate`
    // entry.
    this.emit('lr-activate', { value: option.value });
  }

  /** Removes one occurrence, rather than collapsing every row sharing its public string value. */
  private removeValueAt(index: number): void {
    if (this.effectiveDisabled || index < 0 || index >= this._selected.length)
      return;
    this._restoredStateActive = false;
    this._valueDirty = true;
    this.setSelection(
      this._selected.filter((_, candidateIndex) => candidateIndex !== index),
      this._selectedOptions.filter(
        (_, candidateIndex) => candidateIndex !== index
      )
    );
    this.emitValueEvents();
  }

  /** Empties the selection from the `with-clear` button. Silent when there was nothing to
   *  clear, so `lr-clear` never announces a no-op. */
  private clear(): void {
    if (this.effectiveDisabled || this._selected.length === 0) return;
    this._restoredStateActive = false;
    this._valueDirty = true;
    this.setSelection([], []);
    this.emitValueEvents();
    this.emit('lr-clear');
  }

  private removeTag(value: string, index: number, event: Event): void {
    event.stopPropagation();
    if (this._selected[index] !== value) return;
    this.removeValueAt(index);
    void this.updateComplete.then(() => {
      const buttons = [
        ...this.renderRoot.querySelectorAll<HTMLButtonElement>(
          '[part~="tag__remove-button"]'
        ),
      ];
      (
        buttons[Math.min(index, buttons.length - 1)] ?? this.triggerElement
      )?.focus();
    });
  }

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.onlyOption) return this.selectOption(this.onlyOption);
    if (this.open) void this.hide();
    else void this.show();
  };

  private onTriggerBlur = (event: FocusEvent): void => {
    // A disable-forced blur (the platform blurring a focused native control the instant it
    // becomes disabled -- plain HTML behavior, not specific to custom elements) is not a real
    // user interaction and must not mark the field touched: depending on exact timing, doing so
    // could reenter an in-flight Lit update and trip Lit's dev-mode "scheduled an update after an
    // update completed" warning. This is the same fix as `<lr-input>`'s `onBlur`.
    if (!this.effectiveDisabled) {
      this.touched = true;
      this.hasInteracted = true;
      this.reflectValidityStates();
    }
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // trigger should close it too, the same as lr-combobox's input blur. Native focus traversal is
    // already moving to the user's chosen next stop, so this close must not ask the overlay manager
    // to restore focus back into the select and undo that Tab/Shift+Tab movement.
    if (this.open) this.restoreFocusOnClose = false;
    void this.hide();
    relayNativeEvent(this, event);
  };

  private onTriggerFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  /**
   * Standard listbox type-ahead: moves to the next available option whose
   * label starts with the accumulated buffer, cycling from just after the
   * "current" option (the active row while open, the selected value while
   * closed). While open this only moves `activeIndex` (a highlight, matching
   * Arrow-key nav -- Enter/click still commits it); while closed there's no
   * highlight to show, so it commits immediately, matching a native
   * `<select>`'s closed-state type-ahead.
   */
  private typeAhead(char: string): void {
    this.clearTypeAheadTimer();
    this.typeAheadBuffer += char.toLocaleLowerCase(this.effectiveLocale);
    const ownerWindow = this.ownerDocument.defaultView;
    // A detached or realm-less select arms nothing at all, exactly as before: the controller would
    // otherwise fall back to the ambient timer queue and clear a buffer through a document this
    // element does not live in.
    if (this.isConnected && ownerWindow) this.typeAheadReset.push(ownerWindow);

    const navigable = this.navigableOptions();
    if (!navigable.length) return;
    const currentOption = this.open
      ? navigable[this.activeIndex]
      : this._selectedOptions[this._selectedOptions.length - 1];
    const currentIndex = navigable.indexOf(currentOption as LyraOption);
    const n = navigable.length;
    for (let step = 1; step <= n; step++) {
      const idx = (currentIndex + step + n) % n;
      const candidate = navigable[idx];
      if (candidate === undefined) continue;
      if (
        candidate.label
          .toLocaleLowerCase(this.effectiveLocale)
          .startsWith(this.typeAheadBuffer)
      ) {
        if (this.open) {
          this.setActiveIndex(idx, navigable);
          return;
        }
        if (this.multiple && this._selectedOptions.includes(candidate)) {
          // A closed multi-select must not toggle an already-selected occurrence off. Keep the
          // bounded circular search moving so a later unselected match -- including another row
          // with the same public value -- remains reachable.
          continue;
        }
        this.selectOption(candidate);
        return;
      }
    }
  }

  /** Discards an armed buffer reset. `cancel()`, never `dispose()`: a disconnect here may be a
   *  re-parent, and a disposed controller would refuse every later keystroke's reset for good. */
  private clearTypeAheadTimer(): void {
    this.typeAheadReset.cancel();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.navigableOptions();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) {
          void this.show();
          return;
        }
        this.setActiveIndex(
          Math.min(navigable.length - 1, this.activeIndex + 1),
          navigable
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.onlyOption) return this.selectOption(this.onlyOption);
        if (!this.open) {
          void this.show();
          return;
        }
        this.setActiveIndex(Math.max(0, this.activeIndex - 1), navigable);
        break;
      case 'Enter':
      case ' ':
        // When closed, let the button's native Enter/Space activation fire
        // its own `click` handler (onTriggerClick) to open -- only intercept
        // here to commit/dismiss while already open, so that synthesized
        // click doesn't also re-toggle it shut.
        if (this.open) {
          e.preventDefault();
          const active = navigable[this.activeIndex];
          if (this.activeIndex >= 0 && active) {
            this.selectOption(active);
          } else {
            void this.hide();
          }
        }
        break;
      case 'Escape':
        if (
          this.open &&
          (!this.overlayHandle?.isActive() || this.overlayHandle.isTopmost())
        ) {
          e.preventDefault();
          void this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(0, navigable);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.setActiveIndex(navigable.length - 1, navigable);
        }
        break;
      case 'Backspace':
      case 'Delete':
        // The trigger keeps the native select-style Backspace/Delete shortcut even though the
        // sibling tag row now also provides independently-focusable remove buttons.
        if (this.multiple && this._selected.length > 0) {
          e.preventDefault();
          this.removeValueAt(this._selected.length - 1);
        }
        break;
      default:
        if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
          this.typeAhead(e.key);
        }
        break;
    }
  };

  // Delegated onto [part="listbox"] (see render()) rather than one closure
  // pair allocated per option per render -- resolves the target row via
  // closest('[part="option"]') + a data-value lookup, mirroring lr-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    // Keep focus on the trigger for every listbox surface, including group headings, padding and
    // scrollbar space. The delegated click path still commits only a real option.
    e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest(
      '[part="option"]'
    ) as HTMLElement | null;
    const index = Number(optionEl?.dataset['index']);
    if (!Number.isInteger(index)) return;
    const option = this.listboxOptions[index];
    if (option) this.selectOption(option);
  };

  private adornmentMarkup(option: LyraOption): string {
    return Array.from(option.children)
      .filter((child) => ['start', 'end', 'prefix', 'suffix'].includes(child.getAttribute('slot') ?? ''))
      .map((child) => child.outerHTML)
      .join('');
  }

  /**
   * `<lr-option>` documents `start`/`end` (plus the Shoelace `prefix`/`suffix` aliases) adornment
   * slots, but this listbox is built from its own `[part='option']` rows rather than by exposing
   * the option elements themselves, so a slotted adornment has nowhere to land on its own. Clone it
   * into the row instead -- mirrors lr-combobox's identical `adornmentsFor()`.
   *
   * `cloneNode(true)`, never `createElementNS`: the latter yields an inert, never-upgrading custom
   * element (AGENTS.md), which would silently break the `<lr-flag>`/avatar case this exists for.
   * Cloning also leaves the author's own subtree exactly where they put it -- moving the live node
   * would empty their markup as a side effect of opening the listbox.
   */
  private adornmentsFor(option: LyraOption): { start?: unknown; end?: unknown } {
    const cached = this.adornmentClones.get(option);
    if (cached) return cached;
    const cloneSlot = (selector: string): unknown => {
      const nodes = Array.from(option.querySelectorAll<HTMLElement>(selector));
      if (nodes.length === 0) return undefined;
      return nodes.map((node) => node.cloneNode(true));
    };
    const resolved = {
      markup: this.adornmentMarkup(option),
      start: cloneSlot(':scope > [slot="start"], :scope > [slot="prefix"]'),
      end: cloneSlot(':scope > [slot="end"], :scope > [slot="suffix"]'),
    };
    this.adornmentClones.set(option, resolved);
    return resolved;
  }

  private renderRows(
    options: LyraOption[],
    activeId: string
  ): TemplateResult[] {
    const out: TemplateResult[] = [];
    const chosen = new Set(this._selectedOptions);
    let currentGroup: string | undefined;
    let groupRows: TemplateResult[] = [];
    let groupIndex = 0;
    const flushGroup = (): void => {
      if (groupRows.length === 0) return;
      if (currentGroup) {
        const labelId = `${this.listId}-group-${groupIndex++}`;
        out.push(html`<div role="group" aria-labelledby=${labelId}>
          <div id=${labelId} class="group-label" part="group-label">${currentGroup}</div>
          ${groupRows}
        </div>`);
      } else {
        out.push(...groupRows);
      }
      groupRows = [];
    };
    options.forEach((o, i) => {
      if (o.group !== currentGroup) {
        flushGroup();
        currentGroup = o.group;
      }
      const id = `${this.listId}-opt-${i}`;
      const unknown = this.unknownOptionCache.get(o.value) === o;
      // A synthetic row IS the committed value, so it announces as selected even though
      // `selectedOptions` deliberately never resolves to it -- see `unknownOptions`.
      const selected = unknown || chosen.has(o);
      const adornments = this.adornmentsFor(o);
      groupRows.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-index=${i}
          data-value=${o.value}
          ?data-unknown-value=${unknown}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${this.isOptionAvailable(o) ? 'false' : 'true'}
          ?data-active=${id === activeId}
        >
          ${adornments.start
            ? renderInertPresentation(adornments.start, { part: 'option-start' })
            : ''}
          ${o.dotColor
            ? html`<span
                part="option-dot"
                style=${styleMap({
                  background: sanitizeCssColor(o.dotColor) ?? 'transparent',
                })}
              ></span>`
            : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
          ${unknown
            ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>`
            : ''}
          ${adornments.end
            ? renderInertPresentation(adornments.end, { part: 'option-end' })
            : ''}
        </div>`
      );
    });
    flushGroup();
    return out;
  }

  /** One selected value's chip. `getTag` replaces the whole built-in chip so a consumer owns the
   * markup (and re-declares parts/removal behavior if desired); a returned string renders as text,
   * never as markup. Built-in remove buttons are siblings of the trigger, never nested inside it. */
  private renderTag(value: string, index: number): unknown {
    const option =
      (this._selectedOptions[index]?.value === value
        ? this._selectedOptions[index]
        : undefined) ??
      this.options.find((candidate) => candidate.value === value);
    if (this.getTag && option) return this.getTag(option, index);
    const label = this.labelFor(value, index);
    const unknown = this.isUnknownValue(value, index);
    return html`<span part="tag tag__base" ?data-unknown-value=${unknown}>
      <span part="tag-label"
        ><span part="tag__content" aria-hidden="true">${label}</span
        >${unknown
          ? html`<span part="unknown-value" aria-hidden="true">${this.localize('notInCatalog')}</span>`
          : ''}</span
      >
      <button
        part="tag__remove-button tag__remove-button__base"
        type="button"
        ?disabled=${this.effectiveDisabled}
        aria-label=${this.localize('removeWithContext', undefined, { label })}
        @click=${(event: Event) => this.removeTag(value, index, event)}
      >
        ${closeIcon()}
      </button>
    </span>`;
  }

  override render(): TemplateResult {
    const options = this.listboxOptions;
    const navigable = this.navigableOptions(options);
    const active =
      this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active
      ? `${this.listId}-opt-${options.indexOf(active)}`
      : '';
    const selectedLabel =
      this._selected.length > 0 ? this.labelFor(this._selected[0]!) : '';
    const selectedLabels = this._selected
      .map((value, index) => this.labelFor(value, index))
      .join(', ');
    const hasValue = this._selected.length > 0;
    // `loading` covers the whole pending state, not just its committed-value half. With nothing
    // selected `labelFor()` is never reached, so this branch used to fall through to the
    // consumer's own `placeholder` -- forcing them to re-localize, in their own catalog, the exact
    // string this control already owns and renders for a pending committed value. Same key, so
    // both halves are always the same words.
    const emptyDisplayText = this.loading
      ? this.localize('loading')
      : this.placeholder;
    // Single-mode only: a multi-mode unknown value is flagged per chip by renderTag() instead, and
    // this sr-only join text stays a plain readable string for assistive technology.
    const singleValueUnknown =
      hasValue && !this.multiple && this.isUnknownValue(this._selected[0]!);
    // `0` removes the cap entirely, matching the upstream contract this mirrors.
    const shownValues =
      this.maxOptionsVisible > 0
        ? this._selected.slice(0, this.maxOptionsVisible)
        : this._selected;
    const overflow = this._selected.length - shownValues.length;
    const showClear = (this.withClear || this.clearable) && hasValue;
    const hasHint =
      this.slotPresence.has('hint') ||
      this.slotPresence.has('help-text') ||
      (this.hint ?? '').length > 0 ||
      (this.helpText ?? '').length > 0 ||
      this.withHint;
    const hasError =
      this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const hasLabel =
      this.slotPresence.has('label') || (this.label ?? '').length > 0 || this.withLabel;
    const describedBy = this.localDescriptionIds = [
      this.multiple && hasValue ? this.valueTextId : '',
      hasError ? 'select-error' : '',
      hasHint ? 'select-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    // A single navigable option has no popup to expand into -- when opted in via
    // autoCommitSingleOption, the trigger commits it directly on activation (see
    // onTriggerClick/onKeyDown) instead of opening the listbox, so it's exposed as a plain
    // button rather than a combobox with a permanently-closed popup: no aria-haspopup/
    // aria-expanded/aria-controls/aria-activedescendant (all meaningless without a popup that
    // can ever appear) and no chevron. Without the opt-in (the default), this is always
    // `false` and the normal combobox/listbox/chevron trigger renders regardless of option count.
    const isSingleOption =
      this.autoCommitSingleOption && navigable.length === 1;

    return html`
      <div part="form-control">
        <label
          part="form-control-label"
          for=${this.triggerId}
          ?hidden=${!hasLabel}
        >
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div
          class="control"
          part="combobox form-control-input"
          ?data-clearable=${showClear}
          ?data-multiple=${this.multiple && hasValue}
        >
          <button
            id=${this.triggerId}
            part="trigger"
            type="button"
            title=${this.title || nothing}
            role=${isSingleOption ? 'button' : 'combobox'}
            aria-haspopup=${isSingleOption ? nothing : 'listbox'}
            aria-expanded=${isSingleOption
              ? nothing
              : this.open
              ? 'true'
              : 'false'}
            aria-controls=${isSingleOption ? nothing : this.listId}
            aria-activedescendant=${isSingleOption ? nothing : activeId}
            aria-label=${this.getAttribute('aria-label') ??
            (hasLabel ? nothing : this.placeholder || this.localize('select'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid
              ? 'true'
              : 'false'}
            ?disabled=${this.effectiveDisabled}
            ?autofocus=${this.autofocus}
            @click=${this.onTriggerClick}
            @keydown=${this.onKeyDown}
            @focus=${this.onTriggerFocus}
            @blur=${this.onTriggerBlur}
          >
            <span
              part="start"
              aria-hidden="true"
              inert
              ?hidden=${!this.slotPresence.has('start') &&
              !this.slotPresence.has('prefix')}
            >
              <slot name="start"></slot>
              <slot part="prefix" name="prefix"></slot>
            </span>
            <span
              id=${this.valueTextId}
              class=${this.multiple && hasValue
                ? 'trigger-label sr-only'
                : 'trigger-label'}
              part="display-input"
              ?data-placeholder=${!hasValue}
              ?data-multiple-value=${this.multiple && hasValue}
              ?data-unknown-value=${singleValueUnknown}
              >${hasValue && !this.multiple
                ? selectedLabel
                : this.multiple && hasValue
                ? selectedLabels
                : emptyDisplayText}${singleValueUnknown
                ? html`<span part="unknown-value">${this.localize('notInCatalog')}</span>`
                : ''}</span
            >
            <span
              part="end"
              aria-hidden="true"
              inert
              ?hidden=${!this.slotPresence.has('end') &&
              !this.slotPresence.has('suffix')}
            >
              <slot name="end"></slot>
              <slot part="suffix" name="suffix"></slot>
            </span>
            ${isSingleOption
              ? nothing
              : html`<span part="expand-icon" aria-hidden="true" inert
                  ><slot name="expand-icon">${chevronIcon()}</slot></span
                >`}
          </button>
          ${this.multiple && hasValue
            ? html`<span part="tags"
                >${shownValues.map((value, index) =>
                  this.renderTag(value, index)
                )}${overflow > 0
                  ? html`<span
                      part="tag tag-overflow tag__base"
                      aria-hidden="true"
                      ><span part="tag__content" aria-hidden="true"
                        >${this.localize('selectSelectedOverflow', undefined, {
                          n: getNumberFormat(this.effectiveLocale).format(
                            overflow
                          ),
                        })}</span
                      ></span
                    >`
                  : ''}</span
              >`
            : nothing}
          ${showClear
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-label=${this.localize('clear')}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.clear();
                }}
              >
                <span aria-hidden="true" inert
                  ><slot name="clear-icon">${closeIcon()}</slot></span
                >
              </button>`
            : ''}
        </div>
        <div
          part="listbox"
          id=${this.listId}
          role="listbox"
          aria-multiselectable=${this.multiple ? 'true' : 'false'}
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.renderRows(options, activeId)}
        </div>
        <div id="select-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div
          id="select-hint"
          part="hint form-control-help-text"
          ?hidden=${!hasHint}
        >
          ${this.hint || this.helpText}<slot name="hint"></slot
          ><slot name="help-text"></slot>
        </div>
      </div>
      <slot
        @slotchange=${this.collectOptions}
        @lr-option-change=${this.onOptionChange}
        hidden
      ></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-select': LyraSelect;
  }
}
