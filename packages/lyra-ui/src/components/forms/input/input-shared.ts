import { formControlSupportingState, renderFormControlHintError } from '../../../internal/form-control-template.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { AutocorrectState, installNativeSelectionAccessors, installNativeInputModeAliases, nativeAutocorrectAttribute, setNativeRangeText } from '../../../internal/native-text-control.js';
import { installInteractionOnInvalid } from '../../../internal/invalid-event-alias.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  FormAssociated,
  isBarredFromValidation,
  isLiveDisabled,
} from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { lengthLimitConverter, lengthViolations } from '../../../internal/length-constraints.js';
import {
  MatchConstraintController,
  type LyraMatchTarget,
} from '../../../internal/match-constraint.js';
import { closeIcon, eyeIcon, eyeOffIcon } from '../../../internal/icons.js';
import { styles } from './input.styles.js';
import { isDateObject } from '../../../internal/dom-guards.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { srOnly } from '../../../internal/a11y.js';
import type { LyraAppearance, LyraSize, LyraLabelDisplay, LyraLabelPlacement } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import {
  autocorrectConverter,
  spellcheckConverter,
  blankNumberConverter,
} from '../../../internal/converters.js';
import { finiteCount, finiteDuration } from '../../../internal/numbers.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { DebounceController } from '../../../internal/debounce-controller.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import {
  currentValidityValidator,
  type LyraFormValidator,
} from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_hidePassword, LYRA_DEFAULT_inputLabel, LYRA_DEFAULT_matchMismatch, LYRA_DEFAULT_showPassword } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type LyraInputType =
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'time'
  | 'search'
  | 'date'
  | 'datetime-local'
  | 'tel'
  | 'url';
/** Numeric bound text reads back as a number; date/time text stays a string. */
const boundConverter = {
  fromAttribute: (value: string | null): number | string | null =>
    value == null
      ? null
      : /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*$/i.test(value)
        ? Number(value)
        : value,
};
let temporalProbe: HTMLInputElement | undefined;
/** A detached native input of a date/time `type` that parses and formats values; else undefined. */
function temporalProbeFor(doc: Document, type: string): HTMLInputElement | undefined {
  if (type !== 'date' && type !== 'time' && type !== 'datetime-local') return undefined;
  temporalProbe ??= doc.createElement('input');
  temporalProbe.type = type;
  return temporalProbe;
}

const INPUT_TYPES = new Set<LyraInputType>([
  'text',
  'password',
  'email',
  'number',
  'time',
  'search',
  'date',
  'datetime-local',
  'tel',
  'url',
]);
/** The `type`s whose native `<input>` honors `minlength`/`maxlength` at all. The platform ignores
 *  both on `number`/`time`, so the dirty-value supplement in `updateValidity()` must ignore them
 *  there too rather than being stricter than the control it wraps. */
const LENGTH_CONSTRAINED_TYPES: readonly LyraInputType[] = [
  'text',
  'password',
  'email',
  'search',
  'tel',
  'url',
];
/** The text-entry types, whose entered text can carry its own direction. Date and time fields keep
 *  the surrounding direction, and so does an empty field, so the placeholder and caret start on
 *  the layout's side. */
const AUTO_DIRECTION_TYPES = new Set<string>(LENGTH_CONSTRAINED_TYPES);

export interface LyraInputEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-clear': CustomEvent<null>;
  'lr-input-settled': CustomEvent<{ value: string }>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-invalid': CustomEvent<null>;
}
class LyraInputBase extends LyraElement<LyraInputEventMap> {}

/**
 * Shared native input implementation.
 *
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lr-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lr-change - Compatibility alias for `change`; `detail: { value }`.
 * @event lr-clear - The built-in clear button cleared a text/search value, after the input/change events.
 * @event lr-input-settled - Fires once, `debounce` ms after the last keystroke, alongside the
 *   per-keystroke `input`/`lr-input` pair (which keep firing on every edit). `detail: { value }`,
 *   non-cancelable. A pending debounce is flushed immediately on `change`/Enter/blur, and cancelled
 *   with no stray settle on disconnect, the built-in clear button, and a programmatic `value`
 *   write that actually changes the value -- a same-value write (e.g. the controlled-input pattern
 *   of a framework re-binding `value` from the state its own handler just set) leaves the pending
 *   debounce armed instead of silently defeating it. Never fires while `debounce` is unset, `0`, or
 *   non-finite.
 * @event blur - Re-dispatched from the internal native `<input>`'s own `blur` — bubbling and
 *   composed (unlike the native event, which is neither).
 * @event focus - Re-dispatched from the internal native `<input>`'s own `focus`, for the same reason as `blur`.
 * @event lr-invalid - The input failed a validity check. Cancelable: `preventDefault()` forwards to
 *   the native `invalid` event, suppressing the browser's own validation bubble and the
 *   focus/scroll `reportValidity()` would otherwise perform.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment before the native input.
 * @slot end - Adornment after the native input and built-in actions.
 * @slot prefix - Shoelace alias for `start`.
 * @slot suffix - Shoelace alias for `end`.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot clear-icon - Replaces the built-in clear glyph.
 * @slot show-password-icon - Replaces the glyph shown while the password is hidden.
 * @slot hide-password-icon - Replaces the glyph shown while the password is visible.
 * @csspart form-control - The outer wrapper around label, input, error and hint.
 * @cssprop [--lr-form-control-touch-font-size-min=16px] - Font-size floor of the editable text
 *   surface under a coarse or hover-less pointer, which stops mobile Safari zooming on focus. `0px`
 *   disables it.
 * @cssprop [--lr-form-control-label-inline-size=30%] - Label column width while
 *   `label-placement="start"`; `auto` sizes the column to the label text.
 * @cssprop [--lr-form-control-label-gap] - Space between the label and the field: the label
 *   column gap while `label-placement="start"` (default `var(--lr-space-m)`), and the gap under a
 *   label above the field, in top placement or a collapsed start row (default `var(--lr-space-xs)`).
 * @cssprop [--lr-form-control-label-collapse-inline-size=var(--lr-size-20rem)] - Control width
 *   below which `label-placement="start"` returns the label above the field.
 * @cssprop [--lr-form-control-invalid-border-color=var(--lr-color-danger)] - Resting border while the
 *   field matches `:state(user-invalid)`; shared by every field, overridden by a component-specific
 *   invalid border where one exists.
 * @cssprop [--lr-form-control-font-size] - Size-tier font size for the control text.
 * @cssprop [--lr-form-control-label-font-size=var(--lr-font-size-md-sm)] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=inherit] - Text color of the field label.
 * @cssprop [--lr-form-control-label-line-height=inherit] - Line height of the field label.
 * @cssprop [--lr-form-control-label-text-align=inherit] - Text alignment of the field label.
 * @cssprop [--lr-form-control-label-text-transform=inherit] - Text transform of the field label.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Wrapper around the visible label content.
 * @csspart base - Compatibility name for the control row; use `input-wrapper`.
 * @csspart form-control-input - Compatibility name for the control row.
 * @csspart input-wrapper - The row wrapping the native input and built-in actions. It is the same
 *   node as `base`.
 * @csspart input - The native `<input>` element.
 * @csspart start - Wrapper around the `start` adornment slot. Long content shrinks and ellipsizes
 *   rather than widening the control allocation.
 * @csspart end - Wrapper around the `end` adornment slot, with the same containment behavior.
 * @csspart prefix - Shoelace compatibility part on the `prefix` slot.
 * @csspart suffix - Shoelace compatibility part on the `suffix` slot.
 * @csspart clear-button - The clear action, rendered for non-empty clearable text/search inputs.
 * @csspart password-toggle - The show/hide-password button, rendered only for `type="password"`
 *   with `password-toggle` set.
 * @csspart password-toggle-button - Wrapper around the password-toggle icon.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace compatibility name for the hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-input-control-min-height=var(--lr-form-control-height)] - Outer control height
 *   floor, taken from the active `size` tier of the shared form-control ladder
 *   (`internal/sizes.styles.ts`), so an input is exactly as tall as an `<lr-button>`/`<lr-select>`
 *   of the same tier.
 * @cssprop --lr-input-control-height - Exact outer control height. Unset by default, which leaves
 *   `--lr-input-control-min-height` as a floor only; set it to a length to both floor and cap the
 *   control row (e.g. to pixel-match `<lr-select>`/`<lr-combobox>` in the same toolbar). Because it
 *   is never declared by the component itself, it can be set from an ancestor or an outer-tree rule
 *   as well as inline on the element.
 * @cssprop [--lr-input-padding-block=var(--lr-form-control-padding-block)] - Block padding of the
 *   native input, from the active `size` tier of the shared ladder.
 * @cssprop [--lr-input-padding-inline=var(--lr-form-control-padding-inline)] - Inline padding of
 *   the control row, from the active `size` tier.
 * @cssprop [--lr-input-font-size=var(--lr-form-control-font-size)] - Font size of the native input,
 *   from the active `size` tier.
 * @cssprop [--lr-input-font-family=inherit] - Font family of the native input. It inherits the
 *   host's font by default; set it to restyle only the field text without touching the label or hint.
 * @cssprop [--lr-input-font-variant-numeric=inherit] - `font-variant-numeric` of the native input.
 * @cssprop [--lr-input-line-height=inherit] - Line height of the native input text.
 * @cssprop [--lr-input-number-direction=ltr] - Inline direction of numeric content
 *   (`type="number"`), which renders left-to-right by default so digits and signs keep their order.
 *   Set `rtl` to start the number at the right edge in a right-to-left layout.
 *   Set `tabular-nums` so digits share one width and a column of values lines up; `lr-number-input`
 *   shares the same field styles and honours it too.
 * @cssprop [--lr-input-gap=var(--lr-space-xs)] - Gap between the start/end adornments and the
 * native input in the control row. Unlike the size knobs above it does not vary by `size` tier.
 * Override it to retune without a `::part(input-wrapper)` rule.
 * @cssprop [--lr-input-radius=var(--lr-form-control-radius)] - Corner radius of the control row,
 * from the active `size` tier of the shared ladder (the two tightest tiers take a smaller radius).
 * `pill` swaps it to `--lr-radius-pill`.
 * @cssprop [--lr-input-fill=var(--lr-color-surface)] - Background of the control row. Its private default
 * changes per `appearance`; the public value remains authoritative in every appearance.
 * @cssprop [--lr-input-border-color=var(--lr-color-border)] - Border color of the control row,
 * with a private default that changes per `appearance` in the same way as `--lr-input-fill`.
 * @cssprop [--lr-input-focus-border-color=var(--lr-color-brand)] - Control-row border color while
 *   focus is within the field.
 * @cssprop [--lr-input-action-color=var(--lr-color-text-quiet)] - Resting clear/password/number-
 *   stepper action color.
 * @cssprop [--lr-input-placeholder-color=var(--lr-input-action-color,var(--lr-color-text-quiet))] -
 *   Placeholder text color.
 * @cssprop [--lr-input-action-hover-color=var(--lr-color-text)] - Hovered action color.
 * @cssprop [--lr-input-action-active-color=var(--lr-input-action-hover-color,var(--lr-color-text))] -
 *   Pressed action color.
 * @cssprop [--lr-input-action-active-bg=color-mix(in oklab,var(--lr-color-surface),var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Pressed action background. The same hooks apply to `lr-number-input`'s stepper pair.
 * @cssprop [--lr-input-time-picker-hover-bg=var(--lr-color-brand-quiet)] - Hover background for
 *   the browser-native time-picker indicator when `type="time"`.
 * @cssprop [--lr-input-time-picker-active-bg=var(--lr-color-brand)] - Pressed background for the
 *   browser-native time-picker indicator when `type="time"`.
 * @cssprop [--lr-input-time-picker-focus-bg=var(--lr-color-brand-quiet)] - Focus-visible
 *   background for the native time-picker indicator.
 * @cssprop [--lr-input-time-picker-focus-ring=var(--lr-focus-ring-color)] - Focus-visible outline
 *   color for the native time-picker indicator.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the brand border cue
 * is the accessibility answer to focus and is never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate blank - The live value is empty.
 * @cssstate required - Matches while `required` is set. Style with `lr-input:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error. Never matches while disabled or readonly.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything. Never matches while disabled or readonly.
 * @cssstate user-valid - `valid`, but only after the user has interacted: an edit, a blur,
 * `reportValidity()`, or a submission attempt.
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`, so a pristine required field is not painted red before the user acts.
 */
export class LyraInputShared extends FormAssociated(LyraInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    hidePassword: LYRA_DEFAULT_hidePassword,
    inputLabel: LYRA_DEFAULT_inputLabel,
    matchMismatch: LYRA_DEFAULT_matchMismatch,
    showPassword: LYRA_DEFAULT_showPassword,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static {
    installNativeSelectionAccessors(this.prototype, host => host.inputEl, { methods: false });
  }

  // `sizes` is the library's one form-control ladder, pulled in ahead of this component's own sheet
  // so every `--lr-input-*` geometry knob can simply point at the active tier's value -- and so
  // both spellings of every tier (`s` and `small`, …) work with no per-component rule.
  static override styles = [LyraElement.styles, sizes, srOnly, styles];

  /** Live string value. A Web Awesome-compatible null write clears it without widening reads. */
  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    const normalized = next ?? '';
    if (!this.settlingValueFromInput && normalized !== this.value) this.inputGeneration++;
    super.value = normalized;
    // A write reaching here that did NOT come from `onInput`'s own guarded assignment below is a
    // programmatic `value` write (including `formResetCallback()`'s restore) -- cancel any pending
    // debounce with no stray settle, matching the built-in clear button and disconnection. But
    // NOT when `normalized` matches the value already pending: the idiomatic controlled-input
    // pattern re-binds `value` back from state on every render (including the render right after
    // this element's own `input` handler updated that state), and a write that merely echoes the
    // pending edit must never be mistaken for an external replacement of it.
    if (!this.settlingValueFromInput) this.settledDebounce.cancelIfChanged(normalized);
  }

  private _type: LyraInputType = 'text';
  /** Native input type. Unsupported runtime strings normalize to `text` at the public boundary so
   * native validity, type-dependent chrome, and the reflected host state cannot diverge. */
  @property({ reflect: true })
  get type(): LyraInputType {
    return this._type;
  }
  set type(next: LyraInputType) {
    const old = this._type;
    this._type = INPUT_TYPES.has(next) ? next : 'text';
    if (old !== this._type) this.requestUpdate('type', old);
  }
  /** Visual size on the library's one control ladder — shared with `lr-button`/`lr-select`/
   *  `lr-combobox`, so same-tier controls line up in a toolbar row. Accepts both the canonical
   *  `'2xs'`–`'xl'` steps and Web Awesome's/Shoelace's `'small'`/`'medium'`/`'large'` spellings of
   *  `s`/`m`/`l`; the two render identically. `'2xs'` is the tightest tier, for dense
   *  toolbar-embedded controls. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Visual treatment of the control row, from the library's shared field vocabulary.
   *  `'outlined'` (the mapped default) draws a border without a fill; `'filled-outlined'` draws
   *  the fill, `'filled'` drops the border, `'plain'` drops both, and `'accent'` tints both with
   *  the brand color. Each value only swaps `--lr-input-fill`/`--lr-input-border-color`, so a
   *  consumer can retune any of them without a `::part(input-wrapper)` rule. */
  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  /** Shoelace's boolean spelling for the filled treatment. It does not overwrite an explicit
   * `appearance`; the style alias simply paints the same fill while present. */
  @property({ type: Boolean, reflect: true }) filled = false;
  /** Rounds the control row to a full pill by swapping `--lr-input-radius` to
   *  `--lr-radius-pill`. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Placeholder text forwarded to the native input; also the accessible-name fallback when there is no label. */
  @property() placeholder = '';
  /** Shows a built-in clear action for non-empty `text` and `search` inputs. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Web Awesome's spelling of {@link clearable}, accepted so a mechanical `wa-` → `lr-` rename
   *  does not silently drop the clear action. Prefer `clearable` in new code. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** How long (ms) to wait after the last keystroke before emitting one `lr-input-settled`,
   *  coalescing a burst of rapid edits into a single downstream commit -- the same predicate and
   *  `DebounceController` primitive `<lr-filter-bar>`'s own per-filter `debounce` uses. Omitted,
   *  `0`, or a non-finite value means no debounce at all: `input`/`lr-input` keep firing per keystroke, and `lr-input-settled` never fires. A pending debounce is
   *  flushed immediately by `change`/Enter/blur (so a blur never drops the last keystroke) and
   *  cancelled with no stray settle by disconnection, the built-in clear button, and a
   *  programmatic `value` write that changes the value -- a same-value write does not disturb it. */
  @property({ converter: blankNumberConverter(undefined) }) debounce?: number;
  /** Forwards native read-only behavior to the internal input and disables the clear action. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() label = '';
  /**
   * Whether the `label` renders on screen. `hidden` keeps the label as the accessible name but
   * removes it visually (compact toolbars, table cells); hint, error and required semantics are
   * unaffected. Reflected so styles and `[label-display]` selectors match.
   * @attr label-display
   */
  @property({ attribute: 'label-display', reflect: true }) labelDisplay: LyraLabelDisplay = 'visible';
  /**
   * Where the label sits: `top` (default) above the field, or `start` in an inline-start column
   * of `--lr-form-control-label-inline-size`, with hint and error aligned under the field. Below
   * `--lr-form-control-label-collapse-inline-size` the label returns above the field. The label
   * association is unchanged. Reflected so `[label-placement]` selectors match.
   * @attr label-placement
   */
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: LyraLabelPlacement = 'top';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** SSR slot-presence hint for label content that cannot be inspected before hydration. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint/help-text content that cannot be inspected before hydration. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Native input name. An empty override is preserved. Whitespace alone falls back to the label, placeholder, or localized name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() autocomplete = '';
  /** Forwarded to the internal native control. */
  @property() override title = '';
  /** Forwarded to the internal native `<input>`, so the browser's own autofocus algorithm targets
   *  the real text control rather than the (non-focusable) custom-element host. */
  @property({ type: Boolean }) override autofocus = false;
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  private readonly autocorrectState = new AutocorrectState(this, true);
  /** Native virtual-keyboard hint (`inputmode`) forwarded to the input; empty omits it. */
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native editing-assistance state forwarded as canonical `autocorrect="on"|"off"`. Reads are
   * boolean. Writes accept Web Awesome's boolean IDL and Shoelace's `'on'`/`'off'` vocabulary.
   * @default true
   */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectState.value;
  }
  override set autocorrect(next: boolean | 'off' | 'on') {
    this.autocorrectState.set(next);
  }
  /** Lowercase alias of `inputMode`. */
  declare inputmode: string;
  declare enterkeyhint: string;
  /** Forwarded to the native `<input>`'s `min` for its constraint validation, for any `type`.
   *  Defaults to `undefined`. A numeric attribute reads back as a number, other text as a string. */
  // numeric-guard-exempt: passed straight through to the native <input min> and its own
  // ValidityState.rangeUnderflow check, both of which already tolerate a non-finite value
  // without throwing; never used in arithmetic in this file.
  @property({ converter: boundConverter }) min?: number | string;
  /** Upper counterpart of `min`, with the same parsing and the same default of `undefined`. */
  // numeric-guard-exempt: same rationale as `min` above, for the native <input max> attribute.
  @property({ converter: boundConverter }) max?: number | string;
  /** Accepts `'any'` (the native way to disable step validation) in addition to a numeric step. */
  @property() step?: number | 'any';
  /** Minimum text length, forwarded to the internal native `<input>`'s own `minlength` and
   *  consulted by that same native input's constraint validation (`tooShort`, see
   *  `updateValidity()`). Defaults to `undefined` (no lower bound). Like native `minlength`, an
   *  empty value never violates it — pair it with `required` to also reject empty. Ignored by the
   *  native input for `type="number"`/`type="time"`, exactly as the platform specifies. */
  @property({ converter: lengthLimitConverter }) minlength?: number;
  /** Upper counterpart of `minlength` (native `maxlength`/`tooLong`), with the same parsing and the
   *  same default of `undefined`. Note that native `maxlength` also *prevents* typing beyond the
   *  limit; it reports `tooLong` for values that arrive some other way (paste of a longer value,
   *  a programmatic assignment). */
  @property({ converter: lengthLimitConverter }) maxlength?: number;
  /** A regular expression the value must match in full, forwarded to the internal native
   *  `<input>`'s own `pattern` and validated by it (`patternMismatch`). Defaults to `undefined`
   *  (no pattern). Compiled by the browser with the `v` flag and anchored to the whole value, so
   *  no `^`/`$` is needed; an empty value never violates it. */
  @property() pattern?: string;
  /** `type="password"` only — renders the built-in show/hide-password button. Opt-in: a bare
   *  `type="password"` field ships no toggle at all, so a consumer whose threat model or visual
   *  design excludes one is not forced to hide it with CSS. */
  @property({ type: Boolean, attribute: 'password-toggle', reflect: true })
  passwordToggle = false;
  /** `type="password"` only — whether the field currently reveals its raw text. Toggled by the
   *  built-in `password-toggle` button (named by its action, no `aria-pressed`); also settable by a
   *  consumer up front, with or without that button being rendered. */
  @property({ type: Boolean, attribute: 'password-visible' }) passwordVisible =
    false;
  /** `type="number"` only — suppresses the browser's own increment/decrement spin buttons. Left
   *  unset, the platform's spinners render exactly as they do on a bare `<input type="number">`.
   *  `<lr-number-input>` defaults it the other way, since it draws its own stepper pair. */
  @property({ type: Boolean, attribute: 'without-spin-buttons', reflect: true })
  withoutSpinButtons = false;
  protected get hidesSpinButtons(): boolean {
    return this.withoutSpinButtons;
  }
  /** Declarative cross-field confirmation constraint: a sibling field to compare this one's
   *  `value` against, referenced either by id (resolved in this element's own root — an idref
   *  never crosses a shadow boundary, matching every other idref this library resolves) or by a
   *  direct element reference (works across shadow trees, since no lookup is needed). While set
   *  and resolvable, this field additionally fails validity — `customError`, with a localized
   *  mismatch message — whenever its value differs from the referenced element's own `.value`.
   *  Re-validates automatically whenever either field changes: this field's own edits through the
   *  usual `value` write, and the referenced field's edits through a listener on its `input`/
   *  `change` events. A `match` that does not resolve to a live element (a dangling id, most
   *  commonly) is inert rather than a permanent block on submission — exactly like the platform's
   *  own tolerance of an unresolvable `aria-describedby` idref. Pairs with a plain confirmation
   *  field (`type="password"` or otherwise); the referenced element only needs a string `.value`,
   *  so a native `<input>`/`<textarea>` works the same as another `lr-input`. */
  @property({ attribute: 'match' }) match: LyraMatchTarget = null;
  /** Internal reactive adapter for Shoelace's public `default-value` attribute alias. The
   * supported JS property remains `defaultValue`; this accessor is not public API.
   * @internal
   * @default '' */
  @property({ attribute: 'default-value' })
  get defaultValueAlias(): string {
    return this.defaultValue;
  }
  set defaultValueAlias(next: string) {
    this.defaultValue = next ?? '';
  }

  @state() private touched = false;
  private readonly slotPresence = new SlotPresenceController(this);
  // Guards the `value` setter override above: true only for the synchronous duration of `onInput`'s
  // own assignment, so that write is never mistaken for the programmatic one the setter otherwise
  // cancels a pending debounce for.
  private settlingValueFromInput = false;
  private inputGeneration = 0;
  private readonly settledDebounce = new DebounceController<string>(0, (value) => {
    this.emit('lr-input-settled', { value });
  });
  /** Keeps {@link match}'s referenced field resolved and re-runs `updateValidity()` whenever that
   *  field's own value changes. */
  private readonly matchController = new MatchConstraintController(
    this,
    () => this.match,
    () => this.updateValidity(),
  );

  @query('input') private inputEl?: HTMLInputElement;
  private readonly hostDescription = new HostDescriptionController(
    this,
    () => this.inputEl ?? null,
    () => {
      const description = this.renderRoot.querySelector<HTMLElement>('#input-required');
      return this.required && description ? [description] : [];
    },
  );

  /** Id of the internal native `<input>` (and the `for` of its paired `<label>`), so a
   *  shadow-DOM-aware password manager keys its field detection off the same id the consumer put
   *  on the host, rather than a fixed literal. Falls back to `"input"` when the host carries no
   *  `id`. `id` is a plain
   *  inherited DOM property rather than a reactive `@property`, so a host `id` set declaratively in
   *  markup is picked up on first render (the native IDL reflects the parsed attribute before Lit's
   *  own `render()` runs); mutating `el.id` after first render only takes effect on this component's
   *  next unrelated re-render. */
  private get inputId(): string {
    return this.id || 'input';
  }

  constructor() {
    super();
    installInteractionOnInvalid(this, () => { this.touched = true; });
  }

  override disconnectedCallback(): void {
    this.inputGeneration++;
    // `cancel()`, not `dispose()`: a detached input still fires its timer into a torn-down host
    // without this, but a re-parent (which also runs this) must leave the control able to debounce
    // a later edit -- the same reconnect contract `<lr-filter-bar>`'s own `cancelDebounce()` keeps.
    this.settledDebounce.cancel();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.hostDescription.adopted();
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  /** @internal The `type` the internal native `<input>` renders with. A subclass rendering a
   *  different editing surface than its public `type` (a localized number field edits text)
   *  overrides it. */
  protected get nativeInputType(): string {
    return this.type === 'password' && this.passwordVisible ? 'text' : this.type;
  }

  /** @internal The text the internal native `<input>` shows for the current `value`. */
  protected get nativeInputText(): string {
    return this.value;
  }

  /** @internal Converts the internal native `<input>`'s text into the `value` it edits. */
  protected valueFromNativeText(text: string): string {
    return text;
  }

  /** @internal The native control whose platform behavior backs `valueAsNumber`, `stepUp()`/
   *  `stepDown()` and constraint validation: the rendered `<input>`, unless a subclass edits text
   *  in it and supplies a typed control of its own. `null` before the first render. */
  protected get constraintControl(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  /** The internal native `<input>` element, for direct DOM access — mirrors `<lr-textarea>`'s own `input` getter. */
  get input(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  override click(): void {
    if (!isLiveDisabled(this)) this.inputEl?.click();
  }

  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) return;
    if (!isLiveDisabled(this)) this.inputEl?.focus(options);
  }

  override blur(): void {
    this.inputEl?.blur();
  }

  select(): void {
    this.inputEl?.select();
  }

  /** Native date/time value view. Unsupported input types mirror the native getter and return
   * `null`; assignment follows the native input's own conversion and remains event-silent. */
  get valueAsDate(): Date | null {
    const native = this.inputEl;
    if (!native) return null;
    if (native.value !== this.value) native.value = this.value;
    return native.valueAsDate;
  }

  set valueAsDate(next: Date | null) {
    const native = this.inputEl;
    if (!native) return;
    native.valueAsDate = next;
    this.value = native.value;
  }

  /** A date/time value at local fields (a `time` on today's date), like `lr-date-input`. Silent. */
  get valueAsLocalDate(): Date | null {
    const utc = this.valueAsUTCDate;
    if (!utc) return null;
    const local = new Date();
    if (this.type !== 'time') local.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    local.setHours(utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds(), utc.getUTCMilliseconds());
    return local;
  }

  set valueAsLocalDate(next: Date | null) {
    this.valueAsUTCDate = isDateObject(next)
      ? new Date(next.getTime() - next.getTimezoneOffset() * 60_000)
      : null;
  }

  /** A date/time value at UTC fields, the native `valueAsDate` reading. Silent. */
  get valueAsUTCDate(): Date | null {
    const probe = temporalProbeFor(this.ownerDocument, this.type);
    if (!probe) return null;
    probe.value = this.value;
    return Number.isNaN(probe.valueAsNumber) ? null : new Date(probe.valueAsNumber);
  }

  set valueAsUTCDate(next: Date | null) {
    const probe = temporalProbeFor(this.ownerDocument, this.type);
    if (!probe) return;
    const ms = isDateObject(next) ? next.getTime() : NaN;
    probe.value = '';
    // WebKit throws on a NaN write; a time input takes milliseconds since midnight.
    if (!Number.isNaN(ms)) probe.valueAsNumber = this.type === 'time' ? ((ms % 86_400_000) + 86_400_000) % 86_400_000 : ms;
    this.value = probe.value;
  }

  /** Native numeric view (milliseconds for date/time inputs, numeric value for number inputs).
   * Assignment is silent, matching `HTMLInputElement.valueAsNumber`. */
  get valueAsNumber(): number {
    const native = this.constraintControl;
    if (!native) return Number.NaN;
    if (native.value !== this.value) native.value = this.value;
    return native.valueAsNumber;
  }

  set valueAsNumber(next: number) {
    const native = this.constraintControl;
    if (!native) return;
    native.valueAsNumber = next;
    this.value = native.value;
  }

  /**
   * Opens the browser's own picker for the current `type` (the time picker, the OS colour/file
   * chooser on the types that have one), delegating to the internal native `<input>`.
   *
   * Deliberately failure-tolerant: the platform method throws for every environmental reason a
   * component can neither detect up front nor usefully report — the call not being driven by user
   * activation (`NotAllowedError`), a cross-origin document (`SecurityError`), a non-mutable
   * control (`InvalidStateError`) — and engines that predate it don't define it at all. A picker
   * that cannot open is a no-op here rather than an exception a consumer must wrap every call in.
   * Also a no-op while disabled or readonly, matching every other editing entry point.
   */
  showPicker(): void {
    const native = this.inputEl;
    if (!native || isLiveDisabled(this) || this.readonly) return;
    if (!('showPicker' in HTMLInputElement.prototype)) return;
    try {
      native.showPicker();
    } catch {
      /* No transient activation, no picker for this type, or a non-mutable control. */
    }
  }

  /**
   * Increments the value by `steps` × the effective `step`, through the native `<input>`'s own
   * `stepUp()` — so `min`/`max` clamping and decimal handling stay the platform's, not a
   * hand-rolled reimplementation. Pending `step`, `min`, `max`, and `value` property changes
   * apply synchronously, without waiting for a render.
   *
   * Silent, like the native method: it updates `value`, the submitted form value, and validity,
   * but emits no `input`/`change`. A stepper *button* is a user edit and emits them itself.
   */
  stepUp(steps: number = 1): void {
    this.applyStep('up', steps);
  }

  /** Decrementing counterpart of `stepUp()`, with the same signature and the same silence. */
  stepDown(steps: number = 1): void {
    this.applyStep('down', steps);
  }

  private applyStep(direction: 'up' | 'down', steps: number): void {
    const native = this.constraintControl;
    if (!native || isLiveDisabled(this) || this.readonly) return;
    const count = finiteCount(steps, 1);
    if (count === 0) return;
    // Property writes can precede Lit's render. Native stepping must use those current constraints
    // and the current live value in the same call, including removal of a previous bound.
    native.type = this.type;
    native.min = this.min == null ? '' : String(this.min);
    native.max = this.max == null ? '' : String(this.max);
    native.step = this.step == null ? '' : String(this.step);
    native.value = this.value;
    try {
      if (direction === 'up') native.stepUp(count);
      else native.stepDown(count);
    } catch {
      /* The native control throws InvalidStateError for a type with no allowed value step
         (every non-numeric type, and step="any") — nothing to step, so nothing to do. */
      return;
    }
    if (this.value !== native.value) this.value = native.value;
  }

  /** Cursor/selection extent, mirroring `<lr-textarea>`'s identical passthrough. `null` both when
   *  the internal input hasn't rendered yet and whenever the current `type` doesn't support
   *  selection at all (matching the native `<input>`'s own contract — only `text`/`search` among
   *  this component's types do; `password` also supports it natively but isn't exercised here). */
  declare selectionStart: number | null;

  declare selectionEnd: number | null;

  /** The native `selectionDirection`; `null` before render. */
  declare selectionDirection: LyraSelectionDirection | null;

  /** Passthrough to the native `<input>`'s own `setSelectionRange()`. No-op if the element hasn't
   *  rendered yet, or throws the same native `InvalidStateError` the native `<input>` itself would
   *  for a `type` that doesn't support selection (mirrors `<lr-textarea>`'s `setSelectionRange()`). */
  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: 'forward' | 'backward' | 'none' = 'none',
  ): void {
    this.inputEl?.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection,
    );
  }

  /** Passthrough to the native `<input>`'s own `setRangeText()`, mirroring `<lr-textarea>`'s
   *  method of the same name/signature. No-op if the element hasn't rendered yet. */
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode: 'select' | 'start' | 'end' | 'preserve' = 'preserve',
  ): void {
    const input = this.inputEl;
    if (!input) return;
    setNativeRangeText(input, replacement, start, end, selectMode);
    this.value = this.valueFromNativeText(input.value);
  }

  /**
   * Bridges the internal native `<input>`'s own browser-computed constraint validation (format for
   * `type="email"`, range/step for `type="number"`) into this element's `ElementInternals`, instead
   * of hand-rolling a second regex-based check — a real native input of the right `type` already
   * computes `typeMismatch`/`rangeUnderflow`/`rangeOverflow`/`stepMismatch` correctly. Falls back to
   * the base mixin's plain required-and-empty check before the first render (`inputEl` unset).
   *
   * A typed native input (`number`, `email`, …) also runs its own value-sanitization algorithm on
   * assignment, which silently rewrites an unparseable non-empty value to `''` without setting any
   * `ValidityState` flag — left unchecked, `native.validity.valid` would then read `true` (empty is
   * fine when not required) while `this.value`/the bridged form value still held the literal invalid
   * string. Detect that mismatch and report it as `badInput` instead of trusting native blindly.
   *
   * `minlength`/`maxlength` need the same kind of supplement for a different platform rule: the
   * native `tooShort`/`tooLong` flags are raised only for a value the *user* edited, so an
   * over-length value assigned from script would report valid. `lengthViolations()` recomputes
   * both conditions from `value` and they are OR-ed into the native flags (see
   * `internal/length-constraints.ts`). `patternMismatch` needs no such handling — the platform
   * applies `pattern` to script-assigned values too.
   *
   * Barred controls short-circuit first, through the same `isBarredFromValidation()` predicate the
   * base mixin uses — this override used to check `readonly` alone, so a `<lr-input required
   * disabled>` (or one inside a `<fieldset disabled>`) still reported `valueMissing` and published
   * `:state(invalid)`/`:state(user-invalid)`, which no native `<input required disabled>` does.
   *
   * The declarative `match` constraint (see its own doc comment) is checked last, and only once
   * every other constraint above already reports valid — a confirm field that is merely empty (and
   * `required`) reports `valueMissing`, not a mismatch, exactly like a hand-written comparison
   * would prioritize "did you fill this in" over "does it agree with the other field".
   */
  protected updateValidity(): void {
    const native = this.constraintControl;
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (!native) {
      if (this.required && this.value === '') {
        this[SET_ANCHORED_VALIDITY](
          { valueMissing: true },
          () => this.localize('fieldRequired')
        );
      } else if (this.matchMismatches()) {
        this[SET_ANCHORED_VALIDITY](
          { customError: true },
          () => this.localize('matchMismatch')
        );
      } else {
        this[SET_ANCHORED_VALIDITY]({});
      }
      return;
    }
    if (native.value !== this.value) native.value = this.value;
    const sanitizedAway = this.value !== '' && native.value === '';
    const v = native.validity;
    const own = LENGTH_CONSTRAINED_TYPES.includes(this.type)
      ? lengthViolations(this.value, this.minlength, this.maxlength)
      : { tooShort: false, tooLong: false };
    const tooShort = v.tooShort || own.tooShort;
    const tooLong = v.tooLong || own.tooLong;
    if (v.valid && !tooShort && !tooLong) {
      if (sanitizedAway) {
        this[SET_ANCHORED_VALIDITY](
          { badInput: true },
          () => this.localize('valueInvalid')
        );
        return;
      }
      if (this.matchMismatches()) {
        this[SET_ANCHORED_VALIDITY](
          { customError: true },
          () => this.localize('matchMismatch')
        );
        return;
      }
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      {
        valueMissing: v.valueMissing,
        typeMismatch: v.typeMismatch,
        rangeUnderflow: v.rangeUnderflow,
        rangeOverflow: v.rangeOverflow,
        stepMismatch: v.stepMismatch,
        tooShort,
        tooLong,
        patternMismatch: v.patternMismatch,
        badInput: v.badInput,
      },
      // Empty exactly when the native input itself sees nothing wrong, i.e. when only the
      // dirty-value supplement above fired — the browser has no message for a value it considers
      // valid, so fall back to the localized generic one.
      () => native.validationMessage || this.localize('valueInvalid')
    );
  }

  /** Whether `match` is set, currently resolves to a live element, and that element's own value
   *  differs from this one's -- see `match`'s doc comment for the full contract. A dangling or
   *  unresolvable reference (including one pointed at an element with no comparable string
   *  `.value`) never mismatches: an inert constraint, not a permanent block on submission. */
  private matchMismatches(): boolean {
    if (!this.match) return false;
    const targetValue = this.matchController.targetValue;
    return targetValue !== null && targetValue !== this.value;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value')) setCustomState(this.internals, 'blank', this.value === '');
    this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    // A constraint that tightens without a value write (`el.maxlength = 3` over an existing value)
    // reaches the native input only on this render, so validity has to be recomputed after it --
    // the same reason `min`/`max`/`step` are listed here. `match` joins them so retargeting the
    // reference re-checks the new target immediately, even before it fires its own input/change.
    if (
      changed.has('type') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('step') ||
      changed.has('minlength') ||
      changed.has('maxlength') ||
      changed.has('pattern') ||
      changed.has('match') ||
      changed.has('required') ||
      changed.has('readonly')
    ) {
      this.updateValidity();
    }
  }

  /** Whether `debounce` is a real, positive delay -- mirrors `<lr-filter-bar>`'s own predicate for
   *  the same shape. Omitted, `0`, or non-finite means no debounce (per-keystroke behavior); `finiteDuration()` also caps it at the platform's own timer ceiling. */
  private get effectiveDebounceMs(): number {
    return finiteDuration(this.debounce ?? 0, 0);
  }

  private isDebounced(): boolean {
    return this.effectiveDebounceMs > 0;
  }

  private onInput = (event: InputEvent): void => {
    if (!this.inputEl) return;
    const generation = ++this.inputGeneration;
    this.settlingValueFromInput = true;
    this.value = this.valueFromNativeText(this.inputEl.value);
    this.settlingValueFromInput = false;
    const value = this.value;
    relayNativeEvent(this, event);
    this.emit('lr-input', { value });
    if (generation !== this.inputGeneration) return;
    if (this.isDebounced()) {
      this.settledDebounce.delayMs = this.effectiveDebounceMs;
      this.settledDebounce.push(value);
    } else {
      this.settledDebounce.cancel();
    }
  };

  private onChange = (event: Event): void => {
    if (!this.inputEl) return;
    // Flush BEFORE reassigning `value`: the native input already carries the same string `onInput`
    // last pushed, so this settles that pending value first and the reassignment right after finds
    // nothing left pending to cancel.
    this.settledDebounce.flush();
    this.value = this.valueFromNativeText(this.inputEl.value);
    // Snapshot before relaying: a synchronous native `change` listener that rewrites `value` must
    // not change what this gesture's `lr-change` reports.
    const value = this.value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value });
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onBlur = (event: FocusEvent): void => {
    // A form-associated custom element's own `disabled` state becoming true force-blurs whatever
    // inside its shadow tree currently holds focus -- a platform reaction, not a user interaction.
    // That blur can land synchronously nested inside the very property write that disabled this
    // control (before Lit's own render has even reached the internal native <input>'s `disabled`
    // attribute), so `effectiveDisabled` already reads true here whenever this is that case.
    // Marking `touched` for it was, depending on timing, capable of reentering that same in-flight
    // update and tripping Lit's dev-mode "scheduled an update after an update completed" warning
    // for a state flip nothing observable needed -- a disabled control is barred from validation
    // regardless.
    if (!this.effectiveDisabled) this.touched = true;
    // Insurance alongside the `change` flush above: a test harness (or an engine) that blurs
    // without first dispatching a native `change` must still flush the last-typed value.
    this.settledDebounce.flush();
    relayNativeEvent(this, event);
  };

  /**
   * Implicit form submission, through the shared `internal/submit-on-enter.ts` gate every other
   * text-bearing control in the library now routes through — so the modifier/IME/veto rules and
   * the submitter resolution (including an `<lr-button type="submit">`, which `requestSubmit()`
   * refuses as a submitter) are one implementation rather than one per component.
   */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled || this.readonly) return;
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) this.settledDebounce.flush();
    submitOnEnter(this, event);
  };

  private onTogglePasswordVisible = (): void => {
    this.passwordVisible = !this.passwordVisible;
  };

  private onClear = (): void => {
    if (isLiveDisabled(this) || this.readonly || this.value === '') return;
    this.value = '';
    if (this.inputEl) this.inputEl.value = '';
    const value = this.value;
    dispatchNativeInputEvent(this, { inputType: 'deleteContentBackward' });
    this.emit('lr-input', { value });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value });
    this.emit('lr-clear');
    this.inputEl?.focus();
  };

  /**
   * Extension point for a subclass adding its own controls to the end of the control row, between
   * the built-in clear/password actions and the `end` adornment slot — `<lr-number-input>`'s
   * stepper pair. Renders nothing here, so `<lr-input>`'s own DOM is unchanged.
   */
  protected renderControls(): unknown {
    return nothing;
  }

  /** @internal Part tokens for the shared control row; subclasses append their mapped wrapper. */
  protected get inputWrapperParts(): string {
    return 'base form-control-input input-wrapper';
  }

  override render(): TemplateResult {
    const supporting = {
      presence: this.slotPresence, idPrefix: 'input', hint: this.hint, errorText: this.errorText,
      helpText: this.helpText, withHint: this.withHint,
    };
    const { hasHint, hasError, describedBy } = formControlSupportingState(supporting);
    const hasNamedLabel = this.slotPresence.has('label') || Boolean(normalizeLabel(this.label));
    const hasLabel = hasNamedLabel || this.withLabel;
    const accessibleLabel = this.accessibleLabel === '' ? '' : normalizeLabel(this.accessibleLabel);
    const name = accessibleLabel ?? (hasNamedLabel
      ? nothing
      : normalizeLabel(this.placeholder) ?? this.localize('inputLabel'));
    const isPassword = this.type === 'password';
    const showPasswordToggle = isPassword && this.passwordToggle;
    const nativeType = this.nativeInputType;
    const canClear =
      (this.clearable || this.withClear) &&
      (this.type === 'text' || this.type === 'search') &&
      this.value !== '';
    return html`
      <div part="form-control">
        <label
          part="form-control-label"
          for=${this.inputId}
          ?hidden=${!hasLabel}
        >
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div part=${this.inputWrapperParts}>
          <span
            part="start"
            ?hidden=${!this.slotPresence.has('start') &&
            !this.slotPresence.has('prefix')}
            ?data-textless=${this.slotPresence.textless('start') && this.slotPresence.textless('prefix')}
          >
            <slot name="start"></slot>
            <slot part="prefix" name="prefix"></slot>
          </span>
          <input
            id=${this.inputId}
            part="input"
            type=${nativeType}
            dir=${this.type === 'number' ? 'ltr' : AUTO_DIRECTION_TYPES.has(nativeType) && this.nativeInputText ? 'auto' : nothing}
            name=${this.name || nothing}
            placeholder=${this.placeholder}
            title=${this.title || nothing}
            aria-label=${name}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${hasError ||
            (this.touched && !this.internals.validity.valid)
              ? 'true'
              : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${nativeAutocorrectAttribute(this, this.autocorrect)}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            min=${this.min ?? nothing}
            max=${this.max ?? nothing}
            step=${this.step ?? nothing}
            minlength=${this.minlength ?? nothing}
            maxlength=${this.maxlength ?? nothing}
            pattern=${this.pattern ?? nothing}
            .value=${live(this.nativeInputText)}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?autofocus=${this.autofocus}
            ?data-without-spin-buttons=${this.hidesSpinButtons}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
            @keydown=${this.onKeyDown}
          />
          ${showPasswordToggle
            ? html`<button
                part="password-toggle"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-label=${this.localize(
                  this.passwordVisible ? 'hidePassword' : 'showPassword'
                )}
                @click=${this.onTogglePasswordVisible}
              >
                <span part="password-toggle-button" aria-hidden="true" inert
                  >${this.passwordVisible
                    ? html`<slot name="hide-password-icon"
                        >${eyeOffIcon()}</slot
                      >`
                    : html`<slot name="show-password-icon"
                        >${eyeIcon()}</slot
                      >`}</span
                >
              </button>`
            : ''}
          ${canClear
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled || this.readonly}
                aria-label=${this.localize('clear')}
                @click=${this.onClear}
              >
                <span aria-hidden="true" inert
                  ><slot name="clear-icon">${closeIcon()}</slot></span
                >
              </button>`
            : nothing}
          ${this.renderControls()}
          <span
            part="end"
            ?hidden=${!this.slotPresence.has('end') &&
            !this.slotPresence.has('suffix')}
            ?data-textless=${this.slotPresence.textless('end') && this.slotPresence.textless('suffix')}
          >
            <slot name="end"></slot>
            <slot part="suffix" name="suffix"></slot>
          </span>
        </div>
        ${renderFormControlHintError({ ...supporting, hasHint, hasError, hint: this.hint || this.helpText, helpTextSlot: true })}
        <span
          id="input-required"
          class="sr-only"
          data-required-description
          ?hidden=${!this.required}
        >${this.localize('fieldRequired')}</span>
      </div>
    `;
  }
}

installNativeInputModeAliases(LyraInputShared.prototype);

export function createInputValidators<T extends LyraInputShared>(): LyraFormValidator<T>[] {
  return [
    currentValidityValidator(
    'required',
    'disabled',
    'readonly',
    'value',
    'type',
    'pattern',
    'min',
    'max',
    'step',
    'minlength',
    'maxlength'
    ),
  ];
}
