import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
// Side-effect only: registers this component's form-control-label support (external-label bridge + form-internals capture) with LyraElement, since the base class no longer imports it unconditionally. See registerFormControlLabelSupport()'s own doc in internal/lyra-element.ts.
import '../../../internal/form-control-labels.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  type ComposedFocusRepairSnapshot,
  captureComposedFocusRepair,
  applyComposedFocusRepair,
} from '../../../internal/focus-navigation.js';
import {
  AnchoredValidityController,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import {
  autocorrectConverter,
  normalizeAutocorrect,
  spellcheckConverter,
} from '../../../internal/converters.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './token-input.styles.js';
import {
  attachInternalsSafely,
  createStringArrayFormDataState,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  readStringArrayFormDataState,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_tokenInputEditWithContext, LYRA_DEFAULT_tokenInputRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraTokenInputEventMap {
  'lr-invalid': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-input': CustomEvent<Readonly<{ value: readonly string[] }>>;
  'lr-change': CustomEvent<Readonly<{ value: readonly string[] }>>;
  'lr-add': CustomEvent<Readonly<{ value: string; values: readonly string[] }>>;
  'lr-remove': CustomEvent<{ value: string; index: number }>;
  'lr-token-edit': CustomEvent<{
    value: string;
    previousValue: string;
    index: number;
  }>;
}

/**
 * `delimiter` accepts `null` to mean "never split, and never treat a keystroke as a commit key",
 * which the default string converter can't express: a missing attribute leaves the property at its
 * declared default, and `delimiter=""` would otherwise reach `''.split('')` and explode a draft into
 * individual characters. Both `delimiter="none"` and `delimiter=""` therefore map to `null`;
 * removing the attribute restores the `,` default.
 */
const delimiterConverter = {
  fromAttribute: (value: string | null): string | null => {
    if (value === null) return ',';
    return value === '' || value === 'none' ? null : value;
  },
  toAttribute: (value: string | null): string =>
    value === null ? 'none' : value,
};

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  try {
    const normalized: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') normalized.push(entry);
    }
    return Object.freeze(normalized);
  } catch {
    return Object.freeze([]);
  }
}

const stringArrayConverter = {
  fromAttribute: (value: string | null): readonly string[] | null => {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return normalizeStringArray(parsed);
    } catch {
      return [];
    }
  },
  toAttribute: (value: readonly string[] | null): string | null =>
    value == null ? null : JSON.stringify(value),
};

/** `<lr-token-input>` — an editable, form-associated list of removable tokens.
 *
 * Enter commits the typed draft into a token while there is one; with the draft empty it performs
 * the implicit form submission a native text field would (see `internal/submit-on-enter.ts` — the
 * internal input is in a shadow root and has no form owner, so the platform can never do it here).
 * A `delimiter` keystroke stays purely a commit key and never submits.
 * `select()`, the selection getters/setters, `setSelectionRange()`, and `setRangeText()` expose the
 * native draft input's editing surface. Range edits synchronize the pending draft without
 * emitting user events, so a later delimiter/Enter/blur commit consumes the edited text.
 * `focus()` and `click()` are synchronous no-ops under own or fieldset-cascaded disablement,
 * including the same task that begins the disabled transition before Lit updates the draft input.
 * If a focused token surface disappears through its own remove action or a controlled
 * `value`/`defaultValue` shrink, focus moves to the nearest surviving equivalent surface, or to
 * the draft input when no token remains. A newer external focus destination always wins.
 * @customElement lr-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @slot start - Adornment at the inline-start of the token/input row, before the tokens.
 * @slot end - Adornment at the inline-end of the token/input row, after the draft input.
 * @event input - Native `InputEvent` emitted after a user changes the token list.
 * @event change - Native commit `Event` emitted with `input`.
 * @event lr-input - Lyra input alias; detail is `{ value }` with the current token list.
 * @event lr-change - Lyra commit alias; detail is `{ value }` with the current token list.
 * @event focus - Native `FocusEvent` relayed from the draft input or inline token editor.
 * @event blur - Native `FocusEvent` relayed from the draft input or inline token editor.
 * @event lr-add - One or more tokens are about to be added in a single commit. Detail is
 *   `{ value, values }`, where `value` is the final added token for compatibility and `values` is
 *   the complete ordered batch. Cancelable -- call `preventDefault()` to veto the add (e.g. a
 *   server-side validation check) and the tokens stay out of `value`; the typed draft text is left
 *   in the input unchanged so the user can correct it, rather than being silently cleared.
 * @event lr-remove - A token is about to be removed; detail is `{ value, index }`. Cancelable --
 *   call `preventDefault()` to veto the removal (e.g. pending an async confirmation or a
 *   protected-token check) and the token stays in `value` unchanged.
 * @event lr-token-edit - An existing token is about to be edited in place; detail is
 *   `{ value, previousValue, index }`. Not emitted for a reverted, unchanged, emptied, or
 *   duplicate-colliding edit -- those close the editor with no event. Cancelable -- call
 *   `preventDefault()` to veto the edit and the token stays in `value` unchanged; the inline
 *   editor stays open with the user's edited text intact so they can correct it, rather than
 *   closing and discarding it.
 * @event lr-invalid - The token list failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @csspart form-control - Outer control wrapper.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row.
 * @csspart token - Individual token.
 * @csspart token-label - The token's text, as the roving-focus edit trigger. Rendered only while
 *   `editable` is set. Effective disablement removes every token label's tabindex, exposes
 *   `aria-disabled="true"`, and retires internal focus; re-enabling restores one roving stop.
 * @csspart token-editor - The inline text field replacing a token's text while it is being edited. Rendered only while `editable` is set and that token is open for editing.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-token-input-input-inline-size=var(--lr-size-8rem)] - `flex-basis` of the native text input within the token row.
 * @cssprop [--lr-token-input-min-input-inline-size=var(--lr-size-4rem)] - Inline-size floor of the native text input, so it stays usable once tokens wrap.
 * @cssprop [--lr-token-input-editor-inline-size=var(--lr-size-6rem)] - Inline size of the inline token editor opened by `editable`.
 * @cssprop --lr-token-input-padding - Input-wrapper padding, scaled by `size`.
 * @cssprop --lr-token-input-token-padding - Per-token chip padding, scaled by `size`.
 * @cssprop [--lr-token-input-gap=var(--lr-space-xs)] - Gap between form/row children.
 * @cssprop [--lr-token-input-token-gap=var(--lr-space-2xs)] - Gap inside token chips.
 * @cssprop [--lr-token-input-radius=var(--lr-radius)] - Row/token corner radius. `pill` changes its
 *   private default to `--lr-radius-pill`; an inherited or direct public value still wins.
 * @cssprop [--lr-token-input-token-bg=var(--lr-color-brand-quiet)] - Token chip background.
 * @cssprop [--lr-token-input-action-hover-bg=var(--lr-color-brand-quiet)] - Edit/remove hover background.
 * @cssprop [--lr-token-input-edit-hover-bg=var(--lr-token-input-action-hover-bg)] - Editable token
 *   label hover background, independently themeable from the remove action.
 * @cssprop --lr-token-input-edit-pressed-bg - Editable token label pressed background; defaults to
 *   an active-state mix of `--lr-token-input-edit-hover-bg`.
 * @cssprop [--lr-token-input-remove-hover-bg=var(--lr-token-input-action-hover-bg)] - Remove action
 *   hover background, independently themeable from the editable label.
 * @cssprop --lr-token-input-remove-pressed-bg - Remove action pressed background; defaults to an
 *   active-state mix of `--lr-token-input-remove-hover-bg`.
 * @cssprop [--lr-token-input-focus-border-color=var(--lr-color-brand)] - Focused row border color.
 * @cssprop [--lr-token-input-invalid-border-color=var(--lr-color-danger)] - Invalid row border color.
 * @cssprop --lr-token-input-font-size - Input-wrapper/token font size, scaled by `size`.
 * @cssprop [--lr-token-input-control-min-height=var(--lr-form-control-height)] - Input-wrapper
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-token-input-control-height - Exact input-wrapper height. Unset by default, which
 *   leaves `--lr-token-input-control-min-height` as a floor only; set it to a length to both floor
 *   and cap the row (e.g. to pixel-match a sibling field in the same toolbar row). An uncapped row
 *   grows as tokens wrap; a capped row clips inline overflow and intentionally scrolls in the
 *   block axis so wrapped tokens and their hit-area-floored actions remain reachable. Because it
 *   is never declared by the component itself, it can be set from an ancestor or an outer-tree
 *   rule as well as inline on the element.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssstate required - Matches while `required` is set.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required control with no
 *   tokens yet, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted (blurred the text input,
 *   or been through a `reportValidity()`/submit attempt).
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required control
 *   nobody has touched yet is invalid without being styled as an error.
 * @status stable
 * @since 4.0.0
 */
export class LyraTokenInput extends LyraElement<LyraTokenInputEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    tokenInputEditWithContext: LYRA_DEFAULT_tokenInputEditWithContext,
    tokenInputRequired: LYRA_DEFAULT_tokenInputRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      reflect: true,
      useDefault: true,
      converter: stringArrayConverter,
      noAccessor: true,
    },
  };

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  /** Forwarded to both native text inputs using the native explicit `"true"`/`"false"`
   *  attribute vocabulary. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to both native text inputs. Empty preserves the browser default. */
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Native editing-assistance state forwarded to both text inputs. Reads are boolean; writes
   * accept booleans and the native/Shoelace string vocabulary (`off`/`false` disable it). */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
    this.requestUpdate();
  }
  /** Accessible-name override forwarded to the input wrapper and draft input. Attribute presence
   *  wins, including an explicitly empty `aria-label`, which suppresses visible-label linkage. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Rounds the token row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-token-input-radius`, which the tokens share with the row, so the
   *  chips round with it. */
  @property({ type: Boolean, reflect: true }) pill = false;
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates =
    false;
  /** Allow editing an existing token in place: each token becomes a roving tab stop that opens an
   *  inline editor on click, Enter, or F2. Defaults to `false`, in which case the token row renders
   *  exactly as it does without this feature and stays non-focusable. Own or fieldset-cascaded
   *  disablement removes every edit trigger from focus and marks it `aria-disabled="true"`; one
   *  roving stop is restored when the control becomes enabled again. */
  private _editable = false;
  @property({ attribute: 'editable', type: Boolean, reflect: true })
  get editable(): boolean {
    return this._editable;
  }
  set editable(next: boolean) {
    const old = this._editable;
    this._editable = Boolean(next);
    if (!this._editable) this.discardTransientState(false);
    this.requestUpdate('editable', old);
  }
  /** Character(s) that split a typed draft into several tokens, and (when a single character) the
   *  keystroke that commits the draft. `null` — from the property, or from `delimiter="none"` /
   *  `delimiter=""` — disables both, so a token may contain the delimiter verbatim. Defaults to `,`. */
  @property({ attribute: 'delimiter', converter: delimiterConverter })
  delimiter: string | null = ',';
  @state() private draft = '';
  @state() private touched = false;
  /** Index of the token whose inline editor is open, or `-1` when none is. */
  @state() private editingIndex = -1;
  @state() private editDraft = '';
  /** Roving tab stop of the token row. Read through `activeTokenIndex`, which clamps it against the
   *  current token count so a shrinking list can never leave the row with no tab stop. */
  @state() private rovingIndex = 0;
  private focusEditorPending = false;
  private focusTokenPending = -1;
  private tokenFocusRepairPending?: {
    index: number;
    surface: 'label' | 'remove';
    repair: ComposedFocusRepairSnapshot;
  };
  /** One native blur can be followed by a teardown blur when its commit removes the focused editor. */
  private editorBlurRelayed = false;
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (mirrors lr-select's identical
  // hasLabelSlot/hasHintSlot/hasErrorSlot) and reflected via `hidden`.
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  // Selected by id rather than by tag: an open token editor is also an `input`, and it precedes
  // this one in DOM order, so a bare `input` selector would silently retarget `focus()`, `blur()`,
  // and the validity anchor at the editor while a token is being edited.
  @query('#input') private inputEl?: HTMLInputElement;
  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private labelId = nextId('token-input-label');
  private hintId = nextId('token-input-hint');
  private errorId = nextId('token-input-error');
  private _value: readonly string[] = Object.freeze([]);
  private _defaultValue: readonly string[] = Object.freeze([]);
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;
  // Tracked separately from the consumer's own `disabled` -- a fieldset
  // cascade must never mutate that IDL property/attribute itself (mirrors
  // lr-select's/lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern), only the combined getter below.
  private _fieldsetDisabled = false;
  private _name = '';
  private _required = false;
  private _disabled = false;

  @property({ attribute: false })
  get value(): readonly string[] {
    return this._value;
  }
  set value(next: readonly string[]) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    const normalized = normalizeStringArray(next);
    this.captureTokenFocusRepair(normalized);
    if (this.editingIndex >= 0 && normalized !== old) {
      this.editingIndex = -1;
      this.editDraft = '';
      this.focusEditorPending = false;
    }
    this._value = normalized;
    this.requestUpdate('value', old);
    if (this.internals) this.syncValidity();
  }
  /** Reflected JSON-array reset default; changing it never overwrites a dirty live token list. */
  get defaultValue(): readonly string[] {
    return this._defaultValue;
  }
  set defaultValue(next: readonly string[] | null) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = normalizeStringArray(next);
    this.reflectingDefaultValue = true;
    try {
      if (next == null) this.removeAttribute('value');
      else this.setAttribute('value', JSON.stringify(this._defaultValue));
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  /** The form submission key, reflected synchronously for native form APIs.
   *  This control keys its `FormData` entries directly off `name` (see
   *  `syncValidity()`), so a rename must rebuild that `FormData` in the same
   *  tick -- mirrors `<lr-combobox>`'s identical `name` setter. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.syncValidity();
    this.requestUpdate('name', old);
  }

  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    const wasEffectivelyDisabled = this.effectiveDisabled;
    this._disabled = Boolean(next);
    if (!wasEffectivelyDisabled && this.effectiveDisabled)
      this.retireDisabledInteraction();
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the violation itself is recomputed here rather than
    // left raised on a control the browser will never enforce.
    this.syncValidity();
    this.requestUpdate('disabled', old);
  }

  constructor() {
    super();
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
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init)
    );
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.syncValidity();
  }
  override disconnectedCallback(): void {
    this.tokenFocusRepairPending = undefined;
    this.discardTransientState(true);
    super.disconnectedCallback();
  }
  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
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
  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    const wasEffectivelyDisabled = this.effectiveDisabled;
    this._fieldsetDisabled = disabled;
    if (!wasEffectivelyDisabled && this.effectiveDisabled)
      this.retireDisabledInteraction();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.syncValidity();
    this.requestUpdate();
  }
  /**
   * The anchor stays the main text input even while an inline token editor is open: the only
   * constraint this control can fail is `valueMissing`, which requires an empty token list — and an
   * empty list has no token to edit, so the two states are mutually exclusive.
   * @internal
   */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return (
      this.inputEl ??
      this.renderRoot?.querySelector('[part="input-wrapper"]') ??
      null
    );
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  /** Reporting is what a submit attempt does, and a failed submit is precisely when native
   *  `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
   *  `FormAssociated` mixin. */
  reportValidity(): boolean {
    this.touched = true;
    this.syncValidity();
    return this.internals.reportValidity();
  }
  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that tag is reserved"). A non-empty `message` raises
   * `customError` and becomes `validationMessage`, so the control fails `checkValidity()`, blocks
   * submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` control with no tokens stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (each token add/remove/edit re-runs `syncValidity()`) and a
   * `form.reset()` — matching a native control, where only another `setCustomValidity('')` clears
   * it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    // Republishes `data-invalid` and the six validity custom states from the now-current effective
    // validity. The intrinsic recomputation this also runs is idempotent and, by construction,
    // never touches the custom layer the line above just set.
    this.syncValidity();
  }
  /** Reads both component state and the UA's synchronous fieldset cascade before actions mutate
   * or enter one of this compound control's still-rendered native focus surfaces. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }
  override focus(options?: FocusOptions): void {
    if (this.liveDisabled) return;
    this.inputEl?.focus(options);
  }
  override blur(): void {
    const active = this.shadowRoot?.activeElement;
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }
  /** Focuses the draft text input, mirroring what a real click on the token row would land on --
   *  `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   *  semantics of its own (matches `<lr-combobox>`'s identical override). */
  override click(): void {
    if (this.liveDisabled) return;
    this.inputEl?.focus();
  }
  /** Selects the complete pending draft in the internal native text input. */
  select(): void {
    this.inputEl?.select();
  }
  /** Native draft selection start, or `null` before the internal input renders. */
  get selectionStart(): number | null {
    return this.inputEl?.selectionStart ?? null;
  }
  set selectionStart(value: number | null) {
    if (this.inputEl) this.inputEl.selectionStart = value ?? 0;
  }
  /** Native draft selection end, or `null` before the internal input renders. */
  get selectionEnd(): number | null {
    return this.inputEl?.selectionEnd ?? null;
  }
  set selectionEnd(value: number | null) {
    if (this.inputEl) this.inputEl.selectionEnd = value ?? 0;
  }
  /** Native draft selection direction, or `null` before the internal input renders. */
  get selectionDirection(): HTMLInputElement['selectionDirection'] {
    return this.inputEl?.selectionDirection ?? null;
  }
  set selectionDirection(value: HTMLInputElement['selectionDirection']) {
    if (this.inputEl) this.inputEl.selectionDirection = value ?? 'none';
  }
  /** Passthrough to the native draft input's selection range. */
  setSelectionRange(
    selectionStart: number,
    selectionEnd: number,
    selectionDirection: HTMLInputElement['selectionDirection'] = 'none'
  ): void {
    this.inputEl?.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection ?? 'none'
    );
  }
  /** Applies a native event-silent range edit and synchronizes the pending draft. */
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode: SelectionMode = 'preserve'
  ): void {
    const input = this.inputEl;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.draft = input.value;
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but keeps a future mixin's willUpdate reachable
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'label'
      );
      this.hasHintSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'hint'
      );
      this.hasErrorSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'error'
      );
      this.hasStartSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'start'
      );
      this.hasEndSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute('slot') === 'end'
      );
    }
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private syncValidity(): void {
    // A barred control reports no violation at all, exactly like a native disabled input --
    // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
    // token lists, and with it the documented `:state(user-invalid)` error styling.
    const barred = this.barredFromValidation;
    const missing = !barred && this.required && this.value.length === 0;
    this.validityController.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? this.localize('tokenInputRequired') : ''
    );
    this.toggleAttribute(
      'data-invalid',
      !barred && this.touched && !this.internals.validity.valid
    );
    // The six validity custom states, from the shared helper in `internal/custom-states.ts`. This
    // control drives `ElementInternals` directly rather than through the `FormAssociated` mixin
    // (its value is a `string[]`), so it publishes them itself; `touched` is its own interaction
    // flag, already set on blur, which keeps the `user-*` pair off a pristine control the way
    // native `:user-invalid` does. Every mutation path funnels through here, so this one call
    // covers `value`, `required`, `name`, blur, and `form.reset()`.
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred,
    });
    const data = new FormData();
    if (this.name) this.value.forEach((token) => data.append(this.name, token));
    this.internals.setFormValue(
      this.name ? data : null,
      createStringArrayFormDataState(this.name, this.value)
    );
  }
  private updateValue(next: readonly string[]): void {
    this.value = next;
    this.syncValidity();
    dispatchNativeInputEvent(this);
    this.emit(
      'lr-input',
      Object.freeze({ value: Object.freeze([...this.value]) })
    );
    dispatchNativeEvent(this, 'change');
    this.emit(
      'lr-change',
      Object.freeze({ value: Object.freeze([...this.value]) })
    );
  }
  private addDraft(): void {
    if (this.liveDisabled) return;
    // A null/empty delimiter means the whole draft is one token -- `''.split('')` would otherwise
    // explode the draft into one token per character.
    const parts = this.delimiter
      ? this.draft.split(this.delimiter)
      : [this.draft];
    const candidates = parts.map((token) => token.trim()).filter(Boolean);
    const next = [...this.value];
    const seen = this.allowDuplicates ? null : new Set(next);
    const added: string[] = [];
    for (const token of candidates) {
      if (seen?.has(token)) continue;
      seen?.add(token);
      next.push(token);
      added.push(token);
    }
    if (added.length === 0) {
      this.draft = '';
      return;
    }
    // Emit-then-check-then-mutate, matching `removeToken()`'s veto shape: a host that can already
    // veto a removal has no equivalent way to veto an add otherwise. A vetoed add leaves the draft
    // text in place rather than clearing it -- the user typed something real and gets to correct
    // it, the same way a rejected form submission doesn't blank the field.
    const event = this.emit(
      'lr-add',
      Object.freeze({
        value: added[added.length - 1]!,
        values: Object.freeze([...added]),
      }),
      { cancelable: true }
    );
    if (event.defaultPrevented) return;
    this.updateValue(next);
    this.draft = '';
  }

  /** Clears lifecycle-only editing state before focus teardown can turn a blur into a commit. */
  private discardTransientState(clearDraft: boolean): void {
    this.editingIndex = -1;
    this.editDraft = '';
    this.focusEditorPending = false;
    this.focusTokenPending = -1;
    if (clearDraft) {
      this.draft = '';
      if (this.inputEl) this.inputEl.value = '';
    }
  }

  /** Retire every focus/edit surface when own or fieldset disablement becomes effective. */
  private retireDisabledInteraction(): void {
    this.tokenFocusRepairPending = undefined;
    this.discardTransientState(true);
    const active = this.shadowRoot?.activeElement;
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  /** Capture focus before a controlled shrink removes its shadow descendant. The shared repair
   * guard prevents this deferred move from overriding a newer explicit focus destination. */
  private captureTokenFocusRepair(next: readonly string[]): void {
    this.tokenFocusRepairPending = undefined;
    const tokens = [
      ...(this.renderRoot?.querySelectorAll<HTMLElement>('[part~="token"]') ??
        []),
    ];
    // A controlled listener can synchronously echo the already-updated value before Lit removes
    // the old token DOM. Compare with that rendered list, not with the previous property value, so
    // the second setter cannot erase the still-required repair.
    if (next.length >= tokens.length) return;
    const active = activeElementIn(this.shadowRoot) as HTMLElement | null;
    const token = active?.closest<HTMLElement>('[part~="token"]');
    if (!active || !token) return;
    const index = tokens.indexOf(token);
    if (index < 0) return;
    const repair = captureComposedFocusRepair(this, active);
    if (!repair) return;
    const targetIndex = Math.min(index, Math.max(0, next.length - 1));
    this.rovingIndex = targetIndex;
    this.tokenFocusRepairPending = {
      index: targetIndex,
      surface: active.matches('[part~="remove"]') ? 'remove' : 'label',
      repair,
    };
  }

  private removeToken(index: number): void {
    if (this.liveDisabled) return;
    const removed = this.value[index];
    // The roving/edit index can outlive the token it pointed at, and `lr-remove` promises a
    // `string` value -- a stale index has nothing to remove rather than a token named `undefined`.
    if (removed === undefined) return;
    const event = this.emit(
      'lr-remove',
      { value: removed, index },
      { cancelable: true }
    );
    if (event.defaultPrevented) return;
    // Removing a token reindexes every later one, so an editor left open over the old indices would
    // commit against the wrong token.
    if (this.editingIndex >= 0) {
      this.editingIndex = -1;
      this.editDraft = '';
    }
    this.updateValue(this.value.filter((_token, i) => i !== index));
  }
  /**
   * The token row's roving tab stop, clamped to the current token count. Derived rather than
   * stored so a token list that shrinks below the focused index still leaves exactly one tab stop.
   */
  private get activeTokenIndex(): number {
    if (!this.value.length) return -1;
    return Math.min(Math.max(this.rovingIndex, 0), this.value.length - 1);
  }

  /** Open the inline editor for a token, seeded with that token's full current text. */
  private startEdit(index: number): void {
    if (this.liveDisabled || !this.editable) return;
    if (index < 0 || index >= this.value.length) return;
    this.editingIndex = index;
    this.editDraft = this.value[index]!; // safe: index bounds-checked above
    this.rovingIndex = index;
    this.editorBlurRelayed = false;
    this.focusEditorPending = true;
  }

  /** Close the editor discarding its contents, returning focus to the token it was opened from. */
  private cancelEdit(): void {
    if (this.editingIndex < 0) return;
    this.focusTokenPending = this.editingIndex;
    this.editingIndex = -1;
    this.editDraft = '';
  }

  /**
   * Close the editor, applying its contents when they are a usable change. An emptied editor
   * cancels rather than removing the token -- removal stays the explicit job of the remove button
   * -- and an edit colliding with an existing token under `allowDuplicates = false` is discarded,
   * mirroring how `addDraft()` skips a duplicate candidate instead of rejecting the whole entry.
   * None of those "no usable change" cases fire `lr-token-edit`, so the editor closes for them
   * unconditionally.
   *
   * A genuine change emits `lr-token-edit` as cancelable and checks `defaultPrevented` *before*
   * closing the editor or mutating `value` -- the same emit-then-check-then-mutate shape
   * `removeToken()` uses for `lr-remove`. A vetoed edit leaves the editor open with the user's
   * edited (uncommitted) text intact, so they can correct it, rather than closing and discarding
   * it. Only past that veto check does the editor close first, so the teardown blur it triggers
   * re-enters this method as a no-op rather than committing (and emitting `change`) a second time.
   */
  private commitEdit(restoreFocus: boolean): void {
    if (this.liveDisabled) {
      this.discardTransientState(false);
      return;
    }
    const index = this.editingIndex;
    if (index < 0) return;
    const previousValue = this.value[index];
    const next = this.editDraft.trim();
    const noUsableChange =
      // Editor state is cleared below even for a stale index; there is simply no previous token to
      // report, and `lr-token-edit` promises a `string` `previousValue`.
      previousValue === undefined ||
      !next ||
      next === previousValue ||
      (!this.allowDuplicates &&
        this.value.some((token, i) => i !== index && token === next));
    if (noUsableChange) {
      // Only a keyboard commit pulls focus back to the token: a blur commit means the user already
      // aimed focus somewhere else (the text input, the next token, another control entirely), and
      // stealing it back would fight them.
      if (restoreFocus) this.focusTokenPending = index;
      this.editingIndex = -1;
      this.editDraft = '';
      return;
    }
    const event = this.emit(
      'lr-token-edit',
      { value: next, previousValue, index },
      { cancelable: true }
    );
    if (event.defaultPrevented) return;
    if (restoreFocus) this.focusTokenPending = index;
    this.editingIndex = -1;
    this.editDraft = '';
    this.updateValue(
      this.value.map((token, i) => (i === index ? next : token))
    );
  }

  private moveRovingFocus(index: number): void {
    if (!this.value.length) return;
    const clamped = Math.min(Math.max(index, 0), this.value.length - 1);
    this.rovingIndex = clamped;
    this.focusTokenPending = clamped;
  }

  private onTokenKeyDown(event: KeyboardEvent, index: number): void {
    if (this.liveDisabled) return;
    // ArrowLeft/ArrowRight mean previous/next *visually*, so they swap under RTL.
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    // Space activates alongside Enter because the token carries `role="button"`; F2 matches the
    // grid/tree convention for "edit this cell in place".
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'F2') {
      event.preventDefault();
      this.startEdit(index);
    } else if (event.key === forward) {
      event.preventDefault();
      this.moveRovingFocus(index + 1);
    } else if (event.key === backward) {
      event.preventDefault();
      this.moveRovingFocus(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.moveRovingFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.moveRovingFocus(this.value.length - 1);
    }
  }

  private onEditInput = (event: Event): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    this.editDraft = (event.target as HTMLInputElement).value;
  };
  private onEditFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    this.editorBlurRelayed = false;
    relayNativeEvent(this, event);
  };
  private onEditKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(true);
    }
    // Escape is consumed rather than left to bubble: an enclosing dialog/popover would otherwise
    // close on the same keystroke that only meant "abandon this token edit".
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEdit();
    }
  };
  private onEditBlur = (event: FocusEvent): void => {
    if (this.editorBlurRelayed) {
      event.stopPropagation();
      return;
    }
    this.editorBlurRelayed = true;
    event.stopPropagation();
    // A disconnect can synchronously trigger blur just before `disconnectedCallback()` clears the
    // editor. Publish the host blur one microtask later so lifecycle state settles first, while
    // still committing before that public blur for a genuine user focus move.
    queueMicrotask(() => {
      if (!this.isConnected || !this.editable || this.liveDisabled) {
        this.discardTransientState(false);
      } else {
        this.commitEdit(false);
      }
      relayNativeEvent(this, event);
    });
  };

  private onInput = (event: Event): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    this.draft = (event.target as HTMLInputElement).value;
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    if (
      event.key === 'Enter' ||
      (this.delimiter !== null && event.key === this.delimiter)
    ) {
      if (this.draft.trim()) {
        event.preventDefault();
        this.addDraft();
      }
      // No draft to commit, so Enter means what it means in any other text field: implicit
      // submission of the ancestor form. Only Enter -- a delimiter keystroke is this component's
      // own commit key, never a submit key.
      else if (event.key === 'Enter') submitOnEnter(this, event);
    } else if (event.key === 'Tab') {
      if (this.draft.trim()) this.addDraft();
    }
    // An open token editor owns Backspace: the destructive "remove the last token" shortcut must
    // not fire for a keystroke that was aimed at the text being edited.
    else if (
      event.key === 'Backspace' &&
      !this.draft &&
      this.value.length &&
      this.editingIndex < 0
    ) {
      this.removeToken(this.value.length - 1);
    }
  };
  // Disabling a focused native control blurs it as plain platform
  // behavior (nothing to do with custom elements) -- that is not a real user interaction, so it
  // must not commit a pending draft or flip `touched`, which could otherwise reenter an in-flight
  // Lit update and trip its dev-mode "scheduled an update after an update completed" warning.
  private onBlur = (event: FocusEvent): void => {
    if (!this.liveDisabled) {
      if (this.draft.trim()) this.addDraft();
      this.touched = true;
    }
    this.syncValidity();
    relayNativeEvent(this, event);
  };
  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };
  private stopInternalChange(event: Event): void {
    event.stopPropagation();
  }
  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  formResetCallback(): void {
    this.restoreLiveValueFromDefault();
    this.discardTransientState(true);
    this.rovingIndex = 0;
    this.touched = false;
    this.syncValidity();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try {
      this.value = [...this._defaultValue];
    } finally {
      this.settingDefaultValue = false;
    }
    this._valueDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete'
  ): void {
    this.value = readStringArrayFormDataState(state);
    this.discardTransientState(true);
    this.rovingIndex = 0;
    this.touched = false;
    this.syncValidity();
  }
  /**
   * Focus moves are deferred to here rather than run from the handlers themselves: the editor and
   * the token it replaces only exist after the render that this update produced.
   */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op today, but keeps a future mixin's updated reachable
    if (this.focusEditorPending) {
      this.focusEditorPending = false;
      const editor = this.renderRoot?.querySelector(
        '[part="token-editor"]'
      ) as HTMLInputElement | null;
      editor?.focus();
      editor?.select();
    }
    if (this.focusTokenPending >= 0) {
      const index = this.focusTokenPending;
      this.focusTokenPending = -1;
      const labels = this.renderRoot?.querySelectorAll('[part="token-label"]');
      const label = labels?.[index] as HTMLElement | undefined;
      label?.focus();
      // WebKit does not consistently scroll a newly programmatically-focused shadow descendant
      // inside this capped block-axis scrollport. Make the keyboard destination explicit while
      // keeping both axes at their nearest positions so the page itself does not jump.
      label?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const pending = this.tokenFocusRepairPending;
    this.tokenFocusRepairPending = undefined;
    if (pending) {
      const tokens = [
        ...this.renderRoot.querySelectorAll<HTMLElement>('[part~="token"]'),
      ];
      const token = tokens[pending.index];
      const target =
        (pending.surface === 'remove'
          ? token?.querySelector<HTMLElement>('[part~="remove"]')
          : token?.querySelector<HTMLElement>('[part~="token-label"]')) ??
        token?.querySelector<HTMLElement>('[part~="remove"]') ??
        this.inputEl ??
        null;
      if (applyComposedFocusRepair(pending.repair, target)) {
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }
  private renderRemoveButton(token: string, index: number): TemplateResult {
    return html`<button
      part="remove"
      type="button"
      aria-label=${this.localize('removeWithContext', undefined, {
        label: token,
      })}
      ?disabled=${this.effectiveDisabled}
      @click=${() => this.removeToken(index)}
    >
      ${closeIcon()}
    </button>`;
  }
  private renderEditableToken(token: string, index: number): TemplateResult {
    if (this.editingIndex === index) {
      return html`<span part="token"
        ><input
          part="token-editor"
          .value=${this.editDraft}
          aria-label=${this.localize('tokenInputEditWithContext', undefined, {
            label: token,
          })}
          ?disabled=${this.effectiveDisabled}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
            ? this.autocorrect
              ? 'on'
              : 'off'
            : nothing}
          @input=${this.onEditInput}
          @change=${this.stopInternalChange}
          @keydown=${this.onEditKeyDown}
          @focus=${this.onEditFocus}
          @blur=${this.onEditBlur}
        />${this.renderRemoveButton(token, index)}</span
      >`;
    }
    return html`<span part="token"
      ><span
        part="token-label"
        role="button"
        tabindex=${this.effectiveDisabled
          ? nothing
          : index === this.activeTokenIndex
          ? 0
          : -1}
        aria-disabled=${String(this.effectiveDisabled)}
        aria-label=${this.localize('tokenInputEditWithContext', undefined, {
          label: token,
        })}
        @click=${() => this.startEdit(index)}
        @focus=${() => {
          if (this.rovingIndex !== index) this.rovingIndex = index;
        }}
        @keydown=${(event: KeyboardEvent) => this.onTokenKeyDown(event, index)}
        >${token}</span
      >${this.renderRemoveButton(token, index)}</span
    >`;
  }
  override render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasAccessibleLabel =
      this.hasAttribute('aria-label') || Boolean(this.accessibleLabel);
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const described =
      [hasHint ? this.hintId : '', hasError ? this.errorId : '']
        .filter(Boolean)
        .join(' ') || nothing;
    return html`<div part="form-control">
      <label
        part="form-control-label"
        ?hidden=${!hasLabel}
        for="input"
        id=${this.labelId}
        >${this.label}<slot
          name="label"
          @slotchange=${this.onLabelSlotChange}
        ></slot
      ></label>
      <div
        part="input-wrapper"
        role="group"
        aria-labelledby=${!hasAccessibleLabel && hasLabel
          ? this.labelId
          : nothing}
        aria-label=${hasAccessibleLabel ? this.accessibleLabel : nothing}
      >
        <span part="start" ?hidden=${!this.hasStartSlot}
          ><slot name="start" @slotchange=${this.onStartSlotChange}></slot
        ></span>
        ${this.value.map((token, index) =>
          this.editable
            ? this.renderEditableToken(token, index)
            : html`<span part="token"
                ><span>${token}</span
                ><button
                  part="remove"
                  type="button"
                  aria-label=${this.localize('removeWithContext', undefined, {
                    label: token,
                  })}
                  ?disabled=${this.effectiveDisabled}
                  @click=${() => this.removeToken(index)}
                >
                  ${closeIcon()}
                </button></span
              >`
        )}
        <input
          id="input"
          part="input"
          .value=${this.draft}
          placeholder=${this.placeholder}
          ?disabled=${this.effectiveDisabled}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.hasAttribute('autocorrect') || !this.autocorrect
            ? this.autocorrect
              ? 'on'
              : 'off'
            : nothing}
          aria-label=${hasAccessibleLabel ? this.accessibleLabel : nothing}
          aria-labelledby=${!hasAccessibleLabel && hasLabel
            ? this.labelId
            : nothing}
          aria-describedby=${described}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid
            ? 'true'
            : 'false'}
          @input=${this.onInput}
          @change=${this.stopInternalChange}
          @keydown=${this.onKeyDown}
          @blur=${this.onBlur}
          @focus=${this.onFocus}
        />
        <span part="end" ?hidden=${!this.hasEndSlot}
          ><slot name="end" @slotchange=${this.onEndSlotChange}></slot
        ></span>
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
        ${this.hint}<slot
          name="hint"
          @slotchange=${this.onHintSlotChange}
        ></slot>
      </div>
      <div part="error" id=${this.errorId} ?hidden=${!hasError}>
        ${this.errorText}<slot
          name="error"
          @slotchange=${this.onErrorSlotChange}
        ></slot>
      </div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-token-input': LyraTokenInput;
  }
}
