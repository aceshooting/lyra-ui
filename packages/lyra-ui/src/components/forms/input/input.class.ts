import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { lengthViolations } from '../../../internal/length-constraints.js';
import { closeIcon, eyeIcon, eyeOffIcon } from '../../../internal/icons.js';
import { styles } from './input.styles.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import {
  autocorrectConverter,
  normalizeAutocorrect,
  spellcheckConverter,
} from '../../../internal/converters.js';
import { finiteCount } from '../../../internal/numbers.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_hidePassword, LYRA_DEFAULT_inputLabel, LYRA_DEFAULT_showPassword, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
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

export interface LyraInputEventMap {
  input: InputEvent;
  change: Event;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-clear': CustomEvent<null>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<null>;
  'lr-focus': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}
class LyraInputBase extends LyraElement<LyraInputEventMap> {}

/**
 * `<lr-input>` — a single-line plain-text input primitive, the `lr-*` equivalent of a plain
 * `wa-input`, form-associated via the `FormAssociated` mixin (same shape as `<lr-textarea>`).
 *
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lr-textarea>`/
 * `<lr-select>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/`error`
 * parts) — left unset, the chrome stays hidden. `size` uses the same `xs`–`xl` scale as
 * `<lr-select>`/`<lr-combobox>`, and `appearance` the shared fill/border vocabulary.
 * `type="password"` renders a `password-toggle` eye-icon button — opt-in via the
 * `password-toggle` attribute — that flips the internal native input between
 * `type="password"`/`type="text"` and tracks `passwordVisible`. `type="email"`/`type="number"`
 * (with `min`/`max`/`step`) delegate constraint validation to the internal native `<input>`'s own
 * browser-computed `validity`, bridged into this element's `ElementInternals` by `updateValidity()`
 * — as do `minlength`/`maxlength`/`pattern`, which constrain the text-bearing types.
 * `type="date"`/`type="datetime-local"`/`type="search"`/`type="tel"`/`type="time"`/`type="url"`
 * forward straight through to the matching native input behavior, the same as `type="text"`.
 *
 * A host `aria-label` is forwarded to the internal textbox via the typed `accessibleLabel` property;
 * external `aria-labelledby`/`aria-describedby` idrefs are not copied across the shadow boundary.
 *
 * Forwards the full native selection/editing surface (`selectionStart`/`selectionEnd`,
 * `setSelectionRange()`, `setRangeText()`), the same as `<lr-textarea>`, in addition to
 * `focus()`/`blur()`/`select()`, `showPicker()`, and `stepUp()`/`stepDown()`.
 *
 * Pressing Enter submits the ancestor `<form>`, the implicit submission a native `<input>`
 * performs — the internal input is inside a shadow root and has no form owner of its own, so the
 * platform can never do it here. The form's first enabled submit control becomes
 * `SubmitEvent.submitter` (an `<lr-button type="submit">` included, via its own `click()`), a
 * modifier-held or IME-composition Enter is ignored, and a form with no submit button submits only
 * from a single field — all of it the platform's own rules, shared with every other lyra text
 * control through `internal/submit-on-enter.ts`.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override size, appearance, and pill fallbacks. A value set directly on
 * the input still wins. The same inheritance contract applies to subclasses that reuse this
 * stylesheet, including `<lr-number-input>` and `<lr-native-time-input>`.
 *
 * When a clear or password action is rendered, compact tiers grow only enough to contain its
 * shared `--lr-icon-button-size` hit target. The `l` and `xl` tiers retain their larger shared
 * control heights.
 *
 * @customElement lr-input
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lr-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lr-change - Compatibility alias for `change`; `detail: { value }`.
 * @event lr-clear - The built-in clear button cleared a text/search value, after the input/change events.
 * @event blur - Re-dispatched from the internal native `<input>`'s own `blur` — bubbling and
 *   composed (unlike the native event, which is neither).
 * @event focus - Re-dispatched from the internal native `<input>`'s own `focus`, for the same reason as `blur`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
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
 * @cssprop [--lr-input-gap=var(--lr-space-xs)] - Gap between the start/end adornments and the
 * native input in the control row. Unlike the size knobs above it does not vary by `size` tier.
 * Override it to retune without a `::part(input-wrapper)` rule.
 * @cssprop [--lr-input-radius=var(--lr-form-control-radius)] - Corner radius of the control row,
 * from the active `size` tier of the shared ladder (the two tightest tiers take a smaller radius).
 * `pill` swaps it to `--lr-radius-pill`.
 * @cssprop [--lr-input-fill=transparent] - Background of the control row. Swapped per
 * `appearance`; the documented default is `appearance="outlined"`'s value.
 * @cssprop [--lr-input-border-color=var(--lr-color-border)] - Border color of the control row,
 * swapped per `appearance` in the same way as `--lr-input-fill`.
 * @cssprop [--lr-input-focus-border-color=var(--lr-color-brand)] - Control-row border color while
 *   focus is within the field.
 * @cssprop [--lr-input-action-color=var(--lr-color-text-quiet)] - Resting clear/password/number-
 *   stepper action color.
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
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate blank - The live value is empty.
 * @status stable
 * @since 4.0.0
 */
export class LyraInput extends FormAssociated(LyraInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    hidePassword: LYRA_DEFAULT_hidePassword,
    inputLabel: LYRA_DEFAULT_inputLabel,
    showPassword: LYRA_DEFAULT_showPassword,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraInput>[] {
    return [currentValidityValidator(
      'required', 'disabled', 'readonly', 'value', 'type', 'pattern', 'min', 'max', 'step',
      'minlength', 'maxlength',
    )];
  }
  // `sizes` is the library's one form-control ladder, pulled in ahead of this component's own sheet
  // so every `--lr-input-*` geometry knob can simply point at the active tier's value -- and so
  // both spellings of every tier (`s` and `small`, …) work with no per-component rule.
  static override styles = [LyraElement.styles, sizes, styles];

  /** Live string value. A Web Awesome-compatible null write clears it without widening reads. */
  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    super.value = next ?? '';
  }

  private _type: LyraInputType = 'text';
  /** Native input type. Unsupported runtime strings normalize to `text` at the public boundary so
   * native validity, type-dependent chrome, and the reflected host state cannot diverge. */
  @property({ reflect: true })
  get type(): LyraInputType { return this._type; }
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
  @property() placeholder = '';
  /** Shows a built-in clear action for non-empty `text` and `search` inputs. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Web Awesome's spelling of {@link clearable}, accepted so a mechanical `wa-` → `lr-` rename
   *  does not silently drop the clear action. Prefer `clearable` in new code. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** Forwards native read-only behavior to the internal input and disables the clear action. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() label = '';
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** SSR slot-presence hint for label content that cannot be inspected before hydration. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint/help-text content that cannot be inspected before hydration. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible name overriding the label/placeholder-derived default. Takes precedence over both
   *  `label` and `placeholder` when set, matching `<lr-textarea>`'s `accessibleLabel`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() autocomplete = '';
  /** Forwarded to the internal native control. */
  @property() override title = '';
  /** Forwarded to the internal native `<input>`, so the browser's own autofocus algorithm targets
   *  the real text control rather than the (non-focusable) custom-element host. */
  @property({ type: Boolean }) override autofocus = false;
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native editing-assistance state forwarded as canonical `autocorrect="on"|"off"`. Reads are
   * boolean. Writes accept Web Awesome's boolean IDL and Shoelace's `'on'`/`'off'` vocabulary. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | 'off' | 'on') {
    this.autocorrectValue = normalizeAutocorrect(next);
    // Attribute presence controls whether the native hint is omitted, so removing an `on`
    // attribute must render even though the normalized boolean remains `true`.
    this.requestUpdate();
  }
  get inputmode(): string {
    return this.inputMode;
  }
  set inputmode(next: string) {
    this.inputMode = next ?? '';
  }
  get enterkeyhint(): string {
    return this.enterKeyHint;
  }
  set enterkeyhint(next: string) {
    this.enterKeyHint = next ?? '';
  }
  /** `type="number"` only — forwarded to the internal native `<input>`'s own `min`/`max`/`step`
   *  and consulted by that same native input's constraint validation (see `updateValidity()`).
   *  Defaults to `undefined` (no lower bound). The `min` attribute is parsed as a number here; the
   *  declared type also admits a string so a subclass bound to a non-numeric native input type can
   *  narrow the attribute parsing to that type's own literal form (`<lr-native-time-input>`'s `09:00`)
   *  without redeclaring the whole property surface. */
  // numeric-guard-exempt: passed straight through to the native <input min> and its own
  // ValidityState.rangeUnderflow check, both of which already tolerate a non-finite value
  // without throwing; never used in arithmetic in this file.
  @property({ type: Number }) min?: number | string;
  /** Upper counterpart of `min`, with the same parsing and the same default of `undefined`. */
  // numeric-guard-exempt: same rationale as `min` above, for the native <input max> attribute.
  @property({ type: Number }) max?: number | string;
  /** Accepts `'any'` (the native way to disable step validation) in addition to a numeric step. */
  @property() step?: number | 'any';
  /** Minimum text length, forwarded to the internal native `<input>`'s own `minlength` and
   *  consulted by that same native input's constraint validation (`tooShort`, see
   *  `updateValidity()`). Defaults to `undefined` (no lower bound). Like native `minlength`, an
   *  empty value never violates it — pair it with `required` to also reject empty. Ignored by the
   *  native input for `type="number"`/`type="time"`, exactly as the platform specifies. */
  // numeric-guard-exempt: forwarded straight through to the native <input minlength> attribute
  // and read back only via that same native input's own ValidityState.tooShort, which applies the
  // platform's "rules for parsing non-negative integers" (an unparseable value is ignored, not
  // thrown on). Never used in arithmetic in this file.
  @property({ type: Number }) minlength?: number;
  /** Upper counterpart of `minlength` (native `maxlength`/`tooLong`), with the same parsing and the
   *  same default of `undefined`. Note that native `maxlength` also *prevents* typing beyond the
   *  limit; it reports `tooLong` for values that arrive some other way (paste of a longer value,
   *  a programmatic assignment). */
  // numeric-guard-exempt: same rationale as `minlength` above, for the native <input maxlength>
  // attribute and ValidityState.tooLong.
  @property({ type: Number }) maxlength?: number;
  /** A regular expression the value must match in full, forwarded to the internal native
   *  `<input>`'s own `pattern` and validated by it (`patternMismatch`). Defaults to `undefined`
   *  (no pattern). Compiled by the browser with the `v` flag and anchored to the whole value, so
   *  no `^`/`$` is needed; an empty value never violates it. */
  @property() pattern?: string;
  /** `type="password"` only — renders the built-in show/hide-password button. Opt-in: a bare
   *  `type="password"` field ships no toggle at all, so a consumer whose threat model or visual
   *  design excludes one is not forced to hide it with CSS. */
  @property({ type: Boolean, attribute: 'password-toggle', reflect: true }) passwordToggle = false;
  /** `type="password"` only — whether the field currently reveals its raw text. Toggled by the
   *  built-in `password-toggle` button; also settable by a consumer up front, with or without
   *  that button being rendered. */
  @property({ type: Boolean, attribute: 'password-visible' }) passwordVisible = false;
  /** `type="number"` only — suppresses the browser's own increment/decrement spin buttons. Left
   *  unset, the platform's spinners render exactly as they do on a bare `<input type="number">`.
   *  `<lr-number-input>` defaults it the other way, since it draws its own stepper pair. */
  @property({ type: Boolean, attribute: 'without-spin-buttons', reflect: true }) withoutSpinButtons = false;
  /** Shoelace alias for {@link withoutSpinButtons}. */
  @property({ type: Boolean, attribute: 'no-spin-buttons' }) noSpinButtons = false;
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

  @query('input') private inputEl?: HTMLInputElement;

  /** Id of the internal native `<input>` (and the `for` of its paired `<label>`), so a
   *  shadow-DOM-aware password manager keys its field detection off the same id the consumer put
   *  on the host, rather than a fixed literal. Falls back to `"input"` when the host carries no
   *  `id`, leaving the rendered output byte-identical to before this existed. `id` is a plain
   *  inherited DOM property rather than a reactive `@property`, so a host `id` set declaratively in
   *  markup is picked up on first render (the native IDL reflects the parsed attribute before Lit's
   *  own `render()` runs); mutating `el.id` after first render only takes effect on this component's
   *  next unrelated re-render. */
  private get inputId(): string {
    return this.id || 'input';
  }

  constructor() {
    super();
    this.addEventListener('invalid', () => { this.touched = true; });
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  /** The internal native `<input>` element, for direct DOM access — mirrors `<lr-textarea>`'s own `input` getter. */
  get input(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  override click(): void {
    if (!this.effectiveDisabled) this.inputEl?.click();
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.inputEl?.focus(options);
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

  /** Native numeric view (milliseconds for date/time inputs, numeric value for number inputs).
   * Assignment is silent, matching `HTMLInputElement.valueAsNumber`. */
  get valueAsNumber(): number {
    const native = this.inputEl;
    if (!native) return Number.NaN;
    if (native.value !== this.value) native.value = this.value;
    return native.valueAsNumber;
  }

  set valueAsNumber(next: number) {
    const native = this.inputEl;
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
    if (!native || this.effectiveDisabled || this.readonly) return;
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
   * hand-rolled reimplementation.
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
    const native = this.inputEl;
    if (!native || this.effectiveDisabled || this.readonly) return;
    const count = finiteCount(steps, 1);
    if (count === 0) return;
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
  get selectionStart(): number | null {
    return this.inputEl?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.inputEl) this.inputEl.selectionStart = value ?? 0;
  }

  get selectionEnd(): number | null {
    return this.inputEl?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.inputEl) this.inputEl.selectionEnd = value ?? 0;
  }

  /** Passthrough to the native `<input>`'s own `setSelectionRange()`. No-op if the element hasn't
   *  rendered yet, or throws the same native `InvalidStateError` the native `<input>` itself would
   *  for a `type` that doesn't support selection (mirrors `<lr-textarea>`'s `setSelectionRange()`). */
  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: 'forward' | 'backward' | 'none' = 'none',
  ): void {
    this.inputEl?.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
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
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.value = input.value;
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
   */
  protected updateValidity(): void {
    const native = this.inputEl;
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (!native) {
      if (this.required && this.value === '') {
        this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
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
        this[SET_ANCHORED_VALIDITY]({ badInput: true }, this.localize('valueInvalid'));
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
      native.validationMessage || this.localize('valueInvalid'),
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value')) {
      if (this.value === '') this.internals.states.add('blank');
      else this.internals.states.delete('blank');
    }
    // A constraint that tightens without a value write (`el.maxlength = 3` over an existing value)
    // reaches the native input only on this render, so validity has to be recomputed after it --
    // the same reason `min`/`max`/`step` are listed here.
    if (
      changed.has('type') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('step') ||
      changed.has('minlength') ||
      changed.has('maxlength') ||
      changed.has('pattern') ||
      changed.has('readonly')
    ) {
      this.updateValidity();
    }
  }

  private onInput = (event: InputEvent): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    relayNativeEvent(this, event);
    this.emit('lr-input', { value: this.value });
  };

  private onChange = (event: Event): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value: this.value });
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
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
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  /**
   * Implicit form submission, through the shared `internal/submit-on-enter.ts` gate every other
   * text-bearing control in the library now routes through — so the modifier/IME/veto rules and
   * the submitter resolution (including an `<lr-button type="submit">`, which `requestSubmit()`
   * refuses as a submitter) are one implementation rather than one per component.
   */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled || this.readonly) return;
    submitOnEnter(this, event);
  };

  private onTogglePasswordVisible = (): void => {
    this.passwordVisible = !this.passwordVisible;
  };

  private onClear = (): void => {
    if (this.effectiveDisabled || this.readonly || this.value === '') return;
    this.value = '';
    if (this.inputEl) this.inputEl.value = '';
    dispatchNativeInputEvent(this, { inputType: 'deleteContentBackward' });
    this.emit('lr-input', { value: this.value });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: this.value });
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
    const hasHint =
      this.slotPresence.has('hint') ||
      this.slotPresence.has('help-text') ||
      this.hint.length > 0 ||
      this.helpText.length > 0 ||
      this.withHint;
    const hasError = this.slotPresence.has('error') || this.errorText.length > 0;
    const hasLabel = this.slotPresence.has('label') || this.label.length > 0 || this.withLabel;
    const describedBy = [hasError ? 'input-error' : '', hasHint ? 'input-hint' : ''].filter(Boolean).join(' ');
    const isPassword = this.type === 'password';
    const showPasswordToggle = isPassword && this.passwordToggle;
    const nativeType = isPassword && this.passwordVisible ? 'text' : this.type;
    const canClear =
      (this.clearable || this.withClear) &&
      (this.type === 'text' || this.type === 'search') &&
      this.value !== '';
    return html`
      <div part="form-control">
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div part=${this.inputWrapperParts}>
          <span
            part="start"
            ?hidden=${!this.slotPresence.has('start') && !this.slotPresence.has('prefix')}
          >
            <slot name="start"></slot>
            <slot part="prefix" name="prefix"></slot>
          </span>
          <input
            id=${this.inputId}
            part="input"
            type=${nativeType}
            name=${this.name || nothing}
            placeholder=${this.placeholder}
            title=${this.title || nothing}
            aria-label=${this.accessibleLabel ||
            (hasLabel ? nothing : this.placeholder || this.localize('inputLabel'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${hasError || (this.touched && !this.internals.validity.valid) ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
              ? (this.autocorrect ? 'on' : 'off')
              : nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            min=${this.min ?? nothing}
            max=${this.max ?? nothing}
            step=${this.step ?? nothing}
            minlength=${this.minlength ?? nothing}
            maxlength=${this.maxlength ?? nothing}
            pattern=${this.pattern ?? nothing}
            .value=${this.value}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            ?autofocus=${this.autofocus}
            ?data-without-spin-buttons=${this.withoutSpinButtons || this.noSpinButtons}
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
                aria-label=${this.localize(this.passwordVisible ? 'hidePassword' : 'showPassword')}
                aria-pressed=${this.passwordVisible ? 'true' : 'false'}
                @click=${this.onTogglePasswordVisible}
              >
                <span part="password-toggle-button" aria-hidden="true" inert
                  >${this.passwordVisible
                    ? html`<slot name="hide-password-icon">${eyeOffIcon()}</slot>`
                    : html`<slot name="show-password-icon">${eyeIcon()}</slot>`}</span
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
                <span aria-hidden="true" inert><slot name="clear-icon">${closeIcon()}</slot></span>
              </button>`
            : nothing}
          ${this.renderControls()}
          <span
            part="end"
            ?hidden=${!this.slotPresence.has('end') && !this.slotPresence.has('suffix')}
          >
            <slot name="end"></slot>
            <slot part="suffix" name="suffix"></slot>
          </span>
        </div>
        <div id="input-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div id="input-hint" part="hint form-control-help-text" ?hidden=${!hasHint}>
          ${this.hint || this.helpText}<slot name="hint"></slot><slot name="help-text"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-input': LyraInput;
  }
}
