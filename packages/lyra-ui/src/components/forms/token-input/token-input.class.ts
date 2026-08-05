import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon } from '../../../internal/icons.js';
import { spellcheckConverter } from '../../../internal/converters.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './token-input.styles.js';
import {
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
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_remove, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_tokenInputEditWithContext, LYRA_DEFAULT_tokenInputRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Alias of the library-wide {@linkcode LyraSizeStep}; kept as a named export so existing imports
 *  and the generated manifest keep resolving while there is exactly one definition of the ladder. */
export type LyraTokenInputSize = LyraSizeStep;

/** A no-op stand-in for `ElementInternals`, used only when the host environment has no real
 *  implementation of it (e.g. a downstream consumer's Vitest + happy-dom test suite) --
 *  `attachInternals()` is browser-only, and calling it unconditionally in the constructor would
 *  otherwise throw before any test assertion runs, merely from constructing or importing this
 *  component. Every member here is either an inert value or a no-op: native `<form>`
 *  participation is unavailable in that environment, but that's an acceptable degradation rather
 *  than a hard failure -- same fix as `<lr-checkbox>`'s/`<lr-combobox>`'s identical
 *  `createInternalsSafely`/`createNoopInternals` pair. */
function createInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createNoopInternals();
  try {
    return host.attachInternals();
  } catch {
    return createNoopInternals();
  }
}

function createNoopInternals(): ElementInternals {
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
  } as unknown as ElementInternals;
}

export interface LyraTokenInputEventMap {
  'lr-invalid': CustomEvent<undefined>;
  input: CustomEvent<{ value: string[] }>;
  change: CustomEvent<{ value: string[] }>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  'lr-add': CustomEvent<{ value: string }>;
  'lr-remove': CustomEvent<{ value: string; index: number }>;
  'lr-token-edit': CustomEvent<{ value: string; previousValue: string; index: number }>;
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
  toAttribute: (value: string | null): string => (value === null ? 'none' : value),
};

const stringArrayConverter = {
  fromAttribute: (value: string | null): string[] | null => {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : [];
    } catch {
      return [];
    }
  },
  toAttribute: (value: string[] | null): string | null => value == null ? null : JSON.stringify(value),
};

/** `<lr-token-input>` — an editable, form-associated list of removable tokens.
 *
 * Enter commits the typed draft into a token while there is one; with the draft empty it performs
 * the implicit form submission a native text field would (see `internal/submit-on-enter.ts` — the
 * internal input is in a shadow root and has no form owner, so the platform can never do it here).
 * A `delimiter` keystroke stays purely a commit key and never submits.
 * @customElement lr-token-input
 * @slot label - Visible label content.
 * @slot hint - Supporting text.
 * @slot error - Validation message.
 * @event input - Native-style composed event emitted after a user changes the token list.
 * @event change - Native-style composed commit event emitted with `input`.
 * @event focus - Re-dispatched from the draft input as a bubbling, composed event.
 * @event blur - Re-dispatched from the draft input as a bubbling, composed event.
 * @event lr-add - A token was added; detail is `{ value }`.
 * @event lr-remove - A token is about to be removed; detail is `{ value, index }`. Cancelable --
 *   call `preventDefault()` to veto the removal (e.g. pending an async confirmation or a
 *   protected-token check) and the token stays in `value` unchanged.
 * @event lr-token-edit - An existing token was edited in place and committed; detail is `{ value, previousValue, index }`. Not emitted for a reverted, unchanged, emptied, or duplicate-colliding edit.
 * @event lr-invalid - The token list failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @csspart form-control - Outer control wrapper.
 * @csspart form-control-label - Label.
 * @csspart input-wrapper - Token and input row.
 * @csspart token - Individual token.
 * @csspart token-label - The token's text, as the roving-focus edit trigger. Rendered only while `editable` is set.
 * @csspart token-editor - The inline text field replacing a token's text while it is being edited. Rendered only while `editable` is set and that token is open for editing.
 * @csspart remove - Token remove button.
 * @csspart input - Native text input.
 * @csspart hint - Supporting text.
 * @csspart error - Validation message.
 * @cssprop [--lr-token-input-input-inline-size=var(--lr-size-8rem)] - `flex-basis` of the native text input within the token row.
 * @cssprop [--lr-token-input-min-input-inline-size=var(--lr-size-4rem)] - Inline-size floor of the native text input, so it stays usable once tokens wrap.
 * @cssprop [--lr-token-input-editor-inline-size=var(--lr-size-6rem)] - Inline size of the inline token editor opened by `editable`.
 * @cssprop --lr-token-input-padding - Input-wrapper padding, scaled by `size`.
 * @cssprop --lr-token-input-token-padding - Per-token chip padding, scaled by `size`.
 * @cssprop [--lr-token-input-gap=var(--lr-space-xs)] - Gap between form/row children.
 * @cssprop [--lr-token-input-token-gap=var(--lr-space-2xs)] - Gap inside token chips.
 * @cssprop [--lr-token-input-radius=var(--lr-radius)] - Row/token corner radius. The `pill`
 *   attribute swaps it for `--lr-radius-pill`.
 * @cssprop [--lr-token-input-token-bg=var(--lr-color-brand-quiet)] - Token chip background.
 * @cssprop [--lr-token-input-action-hover-bg=var(--lr-color-brand-quiet)] - Edit/remove hover background.
 * @cssprop [--lr-token-input-focus-border-color=var(--lr-color-brand)] - Focused row border color.
 * @cssprop [--lr-token-input-invalid-border-color=var(--lr-color-danger)] - Invalid row border color.
 * @cssprop --lr-token-input-font-size - Input-wrapper/token font size, scaled by `size`.
 * @cssprop [--lr-token-input-control-min-height=var(--lr-form-control-height)] - Input-wrapper
 *   block-size floor. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-token-input-control-height - Exact input-wrapper height. Unset by default, which
 *   leaves `--lr-token-input-control-min-height` as a floor only; set it to a length to both floor
 *   and cap the row (e.g. to pixel-match a sibling field in the same toolbar row). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule
 *   as well as inline on the element.
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
    collapse: LYRA_DEFAULT_collapse,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    remove: LYRA_DEFAULT_remove,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
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
  /** Forwarded to both native text inputs through the lowercase `autocorrect` attribute.
   *  The camel-cased property avoids the boolean `HTMLElement.autocorrect` DOM typing. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`. The Web Awesome /
   *  Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a
   *  tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Rounds the token row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-token-input-radius`, which the tokens share with the row, so the
   *  chips round with it. */
  @property({ type: Boolean, reflect: true }) pill = false;
  @property({ attribute: 'allow-duplicates', type: Boolean }) allowDuplicates = false;
  /** Allow editing an existing token in place: each token becomes a roving tab stop that opens an
   *  inline editor on click, Enter, or F2. Defaults to `false`, in which case the token row renders
   *  exactly as it does without this feature and stays non-focusable. */
  private _editable = false;
  @property({ attribute: 'editable', type: Boolean, reflect: true })
  get editable(): boolean { return this._editable; }
  set editable(next: boolean) {
    const old = this._editable;
    this._editable = Boolean(next);
    if (!this._editable) this.discardTransientState(false);
    this.requestUpdate('editable', old);
  }
  /** Character(s) that split a typed draft into several tokens, and (when a single character) the
   *  keystroke that commits the draft. `null` — from the property, or from `delimiter="none"` /
   *  `delimiter=""` — disables both, so a token may contain the delimiter verbatim. Defaults to `,`. */
  @property({ attribute: 'delimiter', converter: delimiterConverter }) delimiter: string | null = ',';
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
  // `[part]:empty` never matches -- the part always contains a literal
  // `<slot>` child element regardless of assigned content -- so real
  // emptiness is tracked in JS instead (mirrors lr-select's identical
  // hasLabelSlot/hasHintSlot/hasErrorSlot) and reflected via `hidden`.
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
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
  private _value: string[] = [];
  private _defaultValue: string[] = [];
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
  get value(): string[] { return this._value; }
  set value(next: string[]) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    const normalized = Array.isArray(next) ? [...next] : [];
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
  get defaultValue(): string[] { return [...this._defaultValue]; }
  set defaultValue(next: string[] | null) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = Array.isArray(next) ? [...next] : [];
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
  get name(): string { return this._name; }
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

  get required(): boolean { return this._required; }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.syncValidity();
    this.requestUpdate('required', old);
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    if (this._disabled) this.discardTransientState(true);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the violation itself is recomputed here rather than
    // left raised on a control the browser will never enforce.
    this.syncValidity();
    this.requestUpdate('disabled', old);
  }

  constructor() {
    super();
    this.internals = createInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
  }
  override connectedCallback(): void { super.connectedCallback(); this.syncValidity(); }
  override disconnectedCallback(): void {
    this.discardTransientState(true);
    super.disconnectedCallback();
  }
  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean { return this.disabled || this._fieldsetDisabled; }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.discardTransientState(true);
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
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.inputEl ?? this.renderRoot?.querySelector('[part="input-wrapper"]') ?? null; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  /** Reporting is what a submit attempt does, and a failed submit is precisely when native
   *  `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
   *  `FormAssociated` mixin. */
  reportValidity(): boolean { this.touched = true; this.syncValidity(); return this.internals.reportValidity(); }
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
  override focus(options?: FocusOptions): void { this.inputEl?.focus(options); }
  override blur(): void { this.inputEl?.blur(); }
  /** Focuses the draft text input, mirroring what a real click on the token row would land on --
   *  `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   *  semantics of its own (matches `<lr-combobox>`'s identical override). */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.inputEl?.focus();
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but keeps a future mixin's willUpdate reachable
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
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
    this.validityController.setValidity(missing ? { valueMissing: true } : {}, missing ? this.localize('tokenInputRequired') : '');
    this.toggleAttribute('data-invalid', !barred && this.touched && !this.internals.validity.valid);
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
      createStringArrayFormDataState(this.name, this.value),
    );
  }
  private updateValue(next: string[], event?: 'add' | 'remove'): void {
    this.value = next;
    this.syncValidity();
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
    if (event === 'add') {
      // `lr-add` promises a `string`; an 'add' that produced no token has nothing to announce.
      const added = next[next.length - 1];
      if (added !== undefined) this.emit('lr-add', { value: added });
    }
  }
  private addDraft(): void {
    if (this.effectiveDisabled) return;
    // A null/empty delimiter means the whole draft is one token -- `''.split('')` would otherwise
    // explode the draft into one token per character.
    const parts = this.delimiter ? this.draft.split(this.delimiter) : [this.draft];
    const candidates = parts.map((token) => token.trim()).filter(Boolean);
    for (const token of candidates) {
      if (!this.allowDuplicates && this.value.includes(token)) continue;
      this.updateValue([...this.value, token], 'add');
    }
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

  private removeToken(index: number): void {
    const removed = this.value[index];
    // The roving/edit index can outlive the token it pointed at, and `lr-remove` promises a
    // `string` value -- a stale index has nothing to remove rather than a token named `undefined`.
    if (removed === undefined) return;
    const event = this.emit('lr-remove', { value: removed, index }, { cancelable: true });
    if (event.defaultPrevented) return;
    // Removing a token reindexes every later one, so an editor left open over the old indices would
    // commit against the wrong token.
    if (this.editingIndex >= 0) { this.editingIndex = -1; this.editDraft = ''; }
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
    if (this.effectiveDisabled || !this.editable) return;
    if (index < 0 || index >= this.value.length) return;
    this.editingIndex = index;
    this.editDraft = this.value[index]!; // safe: index bounds-checked above
    this.rovingIndex = index;
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
   * Close the editor, applying its contents when they are a usable change. The editor is closed
   * first so the teardown blur it triggers re-enters this method as a no-op rather than committing
   * (and emitting `change`) a second time. An emptied editor cancels rather than removing the
   * token -- removal stays the explicit job of the remove button -- and an edit colliding with an
   * existing token under `allowDuplicates = false` is discarded, mirroring how `addDraft()` skips a
   * duplicate candidate instead of rejecting the whole entry.
   */
  private commitEdit(restoreFocus: boolean): void {
    const index = this.editingIndex;
    if (index < 0) return;
    const previousValue = this.value[index];
    const next = this.editDraft.trim();
    // Only a keyboard commit pulls focus back to the token: a blur commit means the user already
    // aimed focus somewhere else (the text input, the next token, another control entirely), and
    // stealing it back would fight them.
    if (restoreFocus) this.focusTokenPending = index;
    this.editingIndex = -1;
    this.editDraft = '';
    // Editor state is cleared above even for a stale index; there is simply no previous token to
    // report, and `lr-token-edit` promises a `string` `previousValue`.
    if (previousValue === undefined) return;
    if (!next || next === previousValue) return;
    if (!this.allowDuplicates && this.value.some((token, i) => i !== index && token === next)) return;
    this.updateValue(this.value.map((token, i) => (i === index ? next : token)));
    this.emit('lr-token-edit', { value: next, previousValue, index });
  }

  private moveRovingFocus(index: number): void {
    if (!this.value.length) return;
    const clamped = Math.min(Math.max(index, 0), this.value.length - 1);
    this.rovingIndex = clamped;
    this.focusTokenPending = clamped;
  }

  private onTokenKeyDown(event: KeyboardEvent, index: number): void {
    if (this.effectiveDisabled) return;
    // ArrowLeft/ArrowRight mean previous/next *visually*, so they swap under RTL.
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    // Space activates alongside Enter because the token carries `role="button"`; F2 matches the
    // grid/tree convention for "edit this cell in place".
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'F2') { event.preventDefault(); this.startEdit(index); }
    else if (event.key === forward) { event.preventDefault(); this.moveRovingFocus(index + 1); }
    else if (event.key === backward) { event.preventDefault(); this.moveRovingFocus(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); this.moveRovingFocus(0); }
    else if (event.key === 'End') { event.preventDefault(); this.moveRovingFocus(this.value.length - 1); }
  }

  private onEditInput = (event: Event): void => { this.editDraft = (event.target as HTMLInputElement).value; };
  private onEditKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') { event.preventDefault(); this.commitEdit(true); }
    // Escape is consumed rather than left to bubble: an enclosing dialog/popover would otherwise
    // close on the same keystroke that only meant "abandon this token edit".
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.cancelEdit(); }
  };
  private onEditBlur = (): void => {
    // Native fieldset disablement can move focus just before the FACE callback reaches the host.
    // Deferring one microtask lets every lifecycle signal settle before deciding whether this was
    // a real user blur or teardown.
    queueMicrotask(() => {
      if (
        !this.isConnected ||
        !this.editable ||
        this.effectiveDisabled ||
        this.matches(':disabled')
      ) {
        this.discardTransientState(false);
        return;
      }
      this.commitEdit(false);
    });
  };

  private onInput = (event: Event): void => { this.draft = (event.target as HTMLInputElement).value; };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (event.key === 'Enter' || (this.delimiter !== null && event.key === this.delimiter)) {
      if (this.draft.trim()) { event.preventDefault(); this.addDraft(); }
      // No draft to commit, so Enter means what it means in any other text field: implicit
      // submission of the ancestor form. Only Enter -- a delimiter keystroke is this component's
      // own commit key, never a submit key.
      else if (event.key === 'Enter') submitOnEnter(this, event);
    }
    else if (event.key === 'Tab') { if (this.draft.trim()) this.addDraft(); }
    // An open token editor owns Backspace: the destructive "remove the last token" shortcut must
    // not fire for a keystroke that was aimed at the text being edited.
    else if (event.key === 'Backspace' && !this.draft && this.value.length && this.editingIndex < 0) { this.removeToken(this.value.length - 1); }
  };
  // fr_asxOgk4UhNB07xevCWwFVQ: disabling a focused native control blurs it as plain platform
  // behavior (nothing to do with custom elements) -- that is not a real user interaction, so it
  // must not commit a pending draft or flip `touched`, which could otherwise reenter an in-flight
  // Lit update and trip its dev-mode "scheduled an update after an update completed" warning.
  private onBlur = (): void => {
    if (!this.effectiveDisabled) { if (this.draft.trim()) this.addDraft(); this.touched = true; }
    this.syncValidity();
    this.emit('blur');
  };
  private onFocus = (): void => { this.emit('focus'); };
  private onLabelSlotChange = (e: Event): void => { this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onHintSlotChange = (e: Event): void => { this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  private onErrorSlotChange = (e: Event): void => { this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0; };
  formResetCallback(): void {
    this.restoreLiveValueFromDefault();
    this.discardTransientState(true);
    this.rovingIndex = 0;
    this.touched = false;
    this.syncValidity();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try { this.value = [...this._defaultValue]; }
    finally { this.settingDefaultValue = false; }
    this._valueDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
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
      const editor = this.renderRoot?.querySelector('[part="token-editor"]') as HTMLInputElement | null;
      editor?.focus();
      editor?.select();
    }
    if (this.focusTokenPending >= 0) {
      const index = this.focusTokenPending;
      this.focusTokenPending = -1;
      const labels = this.renderRoot?.querySelectorAll('[part="token-label"]');
      (labels?.[index] as HTMLElement | undefined)?.focus();
    }
  }
  private renderRemoveButton(token: string, index: number): TemplateResult {
    return html`<button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button>`;
  }
  private renderEditableToken(token: string, index: number): TemplateResult {
    if (this.editingIndex === index) {
      return html`<span part="token"><input part="token-editor" .value=${this.editDraft} aria-label=${this.localize('tokenInputEditWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} spellcheck=${this.spellcheck} autocapitalize=${this.autocapitalize || nothing} autocorrect=${this.autoCorrect || nothing} @input=${this.onEditInput} @keydown=${this.onEditKeyDown} @blur=${this.onEditBlur} />${this.renderRemoveButton(token, index)}</span>`;
    }
    return html`<span part="token"><span part="token-label" role="button" tabindex=${index === this.activeTokenIndex ? 0 : -1} aria-label=${this.localize('tokenInputEditWithContext', undefined, { label: token })} @click=${() => this.startEdit(index)} @focus=${() => { if (this.rovingIndex !== index) this.rovingIndex = index; }} @keydown=${(event: KeyboardEvent) => this.onTokenKeyDown(event, index)}>${token}</span>${this.renderRemoveButton(token, index)}</span>`;
  }
  override render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`<div part="form-control">
      <label part="form-control-label" ?hidden=${!hasLabel} for="input" id=${this.labelId}>${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot></label>
      <div part="input-wrapper" role="group" aria-labelledby=${this.accessibleLabel ? nothing : hasLabel ? this.labelId : nothing} aria-label=${this.accessibleLabel || nothing}>
        ${this.value.map((token, index) => this.editable ? this.renderEditableToken(token, index) : html`<span part="token"><span>${token}</span><button part="remove" type="button" aria-label=${this.localize('removeWithContext', undefined, { label: token })} ?disabled=${this.effectiveDisabled} @click=${() => this.removeToken(index)}>${closeIcon()}</button></span>`)}
        <input id="input" part="input" .value=${this.draft} placeholder=${this.placeholder} ?disabled=${this.effectiveDisabled} spellcheck=${this.spellcheck} autocapitalize=${this.autocapitalize || nothing} autocorrect=${this.autoCorrect || nothing} aria-label=${this.accessibleLabel || nothing} aria-labelledby=${this.accessibleLabel ? nothing : hasLabel ? this.labelId : nothing} aria-describedby=${described} aria-required=${this.required ? 'true' : 'false'} aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'} @input=${this.onInput} @keydown=${this.onKeyDown} @blur=${this.onBlur} @focus=${this.onFocus} />
      </div>
      <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot></div>
      <div part="error" id=${this.errorId} ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-token-input': LyraTokenInput; } }
