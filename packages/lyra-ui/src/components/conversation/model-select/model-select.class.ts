import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { AnchoredPopoverController } from '../../../internal/anchored-popover-controller.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { styles } from './model-select.styles.js';
import {
  dispatchNativeEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { spellcheckFromAttributeConverter as spellcheckConverter } from '../../../internal/converters.js';
import { attachLegacyNoopInternalsSafely } from '../../../internal/legacy-noop-internals.js';
import {
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import {
  filterCatalogEntries,
  normalizeCatalog,
  withSyntheticCatalogValue,
  type DisplayCatalogEntry,
} from '../../../internal/catalog-picker.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_model, LYRA_DEFAULT_modelSelectNoModels, LYRA_DEFAULT_modelSelectRequired, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The canonical step a `size` resolves to — an alias of the shared {@linkcode LyraSizeStep}, so
 *  there is one definition of the ladder. The public `size` property accepts {@linkcode LyraSize},
 *  i.e. this plus the `small`/`medium`/`large` spellings. */
export type LyraModelSelectSize = LyraSizeStep;

/** A catalog row: a selectable model, keyed by `id` with a display `label`. */
export interface LyraModelCatalogEntry {
  id: string;
  label: string;
  /** Optional literal icon hint (for example, an emoji), rendered decoratively before `label`. */
  icon?: string;
}

/**
 * The `catalog` shape: either every entry is a plain string (used as both id
 * and label) or every entry is a full `{ id, label, icon? }` row — not a mix of both.
 */
export type LyraModelCatalog = string[] | LyraModelCatalogEntry[];

/** Direction reported by the free-text input's native selection APIs. */
export type LyraModelSelectSelectionDirection = 'forward' | 'backward' | 'none';

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
type DisplayEntry = DisplayCatalogEntry<LyraModelCatalogEntry>;

export interface LyraModelSelectEventMap {
  'lr-invalid': CustomEvent<undefined>;
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  input: Event;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<undefined>;
  'lr-focus': CustomEvent<undefined>;
}
/**
 * `<lr-model-select>` — a provider/model picker that renders as a closed
 * dropdown when a fixed `catalog` is available, or as a filterable free-text
 * combobox when it isn't (or when `allow-custom` explicitly permits typing
 * something outside the catalog). Built directly on the shared
 * trigger-button/aria-activedescendant listbox technique `<lr-select>` uses
 * and the filter-as-you-type suggestion-popup technique `<lr-combobox>`
 * uses — not by composing either element, since the mode switch and the
 * stale-value handling below are specific to this control.
 *
 * A `value` that isn't present in `catalog` (e.g. a model id saved from a
 * provider whose live catalog has since changed) is never silently dropped:
 * `effectiveEntries` appends it to the rendered option list as a synthetic,
 * visually-distinct row (dashed border, italic label, "not in catalog"
 * badge — see `model-select.styles.ts`) computed fresh from `catalog` +
 * `value` on every render, without ever mutating the `catalog` property
 * itself.
 *
 * Object-shaped catalog rows can include a literal `icon`, rendered decoratively as the leading
 * `option-icon` part in either listbox mode. It is presentation only: the row's accessible name
 * remains its `label`.
 *
 * Ships the standard label/hint/error form-control chrome: properties, matching named slots, and
 * the complete `form-control` frame. Each surface is opt-in; left unset, it renders no chrome.
 *
 * @customElement lr-model-select
 * @event lr-change - The selected/typed value changed. `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Fired alongside `lr-change`, mirroring `<lr-select>`/`<lr-combobox>`'s
 *   native-style value-change pair so native form bindings/framework `v-model` handlers behave
 *   consistently across the picker family.
 * @event {Event} input - A payload-preserving `InputEvent` on each free-text edit, and a plain
 *   native `Event` alongside `change` when either rendering mode commits a value.
 * @event blur - Native blur relayed once from the active control in either rendering mode.
 * @event focus - Native focus relayed once from the active control in either rendering mode.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-invalid - The picker failed a validity check. Cancelable: calling `preventDefault()`
 *   also cancels the native `invalid` event behind it, suppressing the browser's own validation
 *   bubble so an app can present the failure its own way.
 * @slot label - Custom visible label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @cssstate required - Matches while `required` is set. Style with `lr-model-select:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: a blur of the
 * trigger/combobox, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required picker is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @csspart form-control - The complete label, control, hint, error, and listbox frame.
 * @csspart form-control-label - The `<label>` element containing the `label` property and slot.
 * @csspart trigger - The trigger button (closed-dropdown mode's positioning anchor).
 * @csspart combobox - The text-input container (free-text mode's positioning anchor).
 * @csspart combobox-input - The free-text mode's text input.
 * @csspart provider-badge - The optional leading `provider` label.
 * @csspart listbox - The options popover (shared by both modes).
 * @csspart option - An option row.
 * @csspart option-icon - An option row's optional decorative leading icon.
 * @csspart option-label - An option row's label.
 * @csspart option-badge - The "not in catalog" badge on a synthetic stale-value row.
 * @csspart empty - The empty-listbox message, shown when no rows match.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-model-select-trigger-padding=var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)] - Trigger/combobox padding shorthand, scaled by `size` off the shared control ladder.
 * @cssprop [--lr-model-select-trigger-min-height=var(--lr-form-control-height)] - Trigger/combobox block-size floor, scaled by `size` off the shared control ladder.
 * @cssprop [--lr-model-select-font-size=var(--lr-form-control-font-size)] - Trigger/combobox font size, scaled by `size` off the shared control ladder.
 * @cssprop [--lr-model-select-expand-size=var(--lr-size-1-75rem)] - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-model-select-gap=var(--lr-space-xs)] - Trigger, combobox, and option child gap.
 * @cssprop [--lr-model-select-radius=var(--lr-radius)] - Trigger, combobox, listbox, and option corner radius.
 * @cssprop [--lr-model-select-open-border-color=var(--lr-color-brand)] - Open trigger border color.
 * @cssprop [--lr-model-select-option-active-bg=var(--lr-color-brand-quiet)] - Background of a hovered or keyboard-active option row.
 * @cssprop [--lr-model-select-option-selected-bg=transparent] - Background of the currently-selected option row. Not declared on `:host`; retheme without hijacking `--lr-color-brand`.
 * @cssprop [--lr-model-select-option-selected-border=var(--lr-color-brand)] - Border color of the selected option row.
 * @cssprop [--lr-model-select-option-selected-color=var(--lr-color-brand)] - Text color of the selected option row.
 * @cssprop [--lr-model-select-option-selected-font-weight=var(--lr-font-weight-semibold)] - Font weight of the selected option row.
 * @cssprop [--lr-model-select-option-synthetic-border-style=dashed] - Border style of a synthetic stale-value option row.
 * @cssprop [--lr-model-select-option-synthetic-border-color=var(--lr-color-border)] - Border color of a synthetic stale-value option row.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 *   `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 *   other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 *   themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 *   required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraModelSelect extends LyraElement<LyraModelSelectEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    model: LYRA_DEFAULT_model,
    modelSelectNoModels: LYRA_DEFAULT_modelSelectNoModels,
    modelSelectRequired: LYRA_DEFAULT_modelSelectRequired,
    noMatches: LYRA_DEFAULT_noMatches,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  // `sizes` before `styles`: the shared sheet declares the --lr-form-control-* knobs per tier, and
  // this component's own :host block points its --lr-model-select-* surface at them.
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    defaultValue: {
      attribute: 'value',
      reflect: true,
      useDefault: true,
      noAccessor: true,
    },
    name: { reflect: true, noAccessor: true },
  };

  /** Informational only — e.g. `'ollama'`. Rendered as a small leading badge for display grouping. */
  @property() provider = '';
  /** The full model list. Omit (or leave empty) to fall back to plain free-text entry. */
  @property({ attribute: false }) catalog?: LyraModelCatalog;
  /** Let the user type/commit a value that isn't in `catalog`, even when `catalog` is non-empty. */
  @property({ type: Boolean, reflect: true, attribute: 'allow-custom' }) allowCustom = false;
  /**
   * Optional visible title above the control, rendered alongside the `label` slot in a
   * `part="form-control-label"` `<label>` paired with the active control's id. A host `aria-label`
   * remains authoritative by presence; otherwise either visible-label source supplies the native
   * associated name. Leaving both empty keeps the `aria-label || placeholder || 'Model'` chain.
   */
  @property() label = '';
  /** Hint text below the field. Unset (the default): no hint chrome renders. */
  @property() hint = '';
  /** Error text below the field (overridden by slotted `error` content). Unset (the default): no
   *  error chrome renders. */
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  /** Forwarded to the free-text mode's native `<input>`'s own `spellcheck`. Defaults to `true`,
   *  matching the native element's own default. No effect in closed-dropdown mode (no native text
   *  input there). `spellcheck="false"` is parsed as `false` (see `spellcheckConverter` above). */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the free-text mode's native `<input>`'s own `autocapitalize`. Empty string omits
   *  the attribute (browser default). */
  @property() override autocapitalize = '';
  /** Forwarded to the free-text mode's native `<input>`'s own `autocorrect` (Safari/WebKit-specific).
   *  Empty string omits the attribute (browser default). Named `autoCorrect` (capital `C`), not
   *  `autocorrect`, purely to dodge a TS `lib.dom.d.ts` collision: newer DOM typings declare a
   *  `boolean`-typed `HTMLElement.autocorrect` IDL member, which conflicts with this string-typed
   *  property of the same name -- same fix as `<lr-textarea>`/`<lr-date-input>`. The explicit
   *  attribute mapping preserves the lowercase wire name in generated component metadata. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Native editing and virtual-keyboard hints forwarded to free-text mode's input. */
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Visual size, on the library-wide six-step ladder (`2xs`–`xl`). `small`/`medium`/`large` are
   *  accepted spellings of `s`/`m`/`l` and render identically, so markup migrated from Web Awesome
   *  or Shoelace needs no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';

  @state() private activeIndex = -1;
  // Free-text mode's live input text. Only meaningful while `open` — the
  // input is otherwise controlled by the committed value's label (see
  // `renderFreeText`), so this never needs resetting on commit/hide.
  @state() private query = '';
  // Set on first blur; gates the `data-invalid` reflection below so
  // validity styling never flashes on first render (matches lr-select).
  @state() private touched = false;
  // `[part]:empty` never matches -- the part always contains a literal <slot> child element
  // regardless of assigned content -- so real emptiness is tracked here instead (same fix as
  // lr-select's identical hasHintSlot/hasErrorSlot) and reflected via the hidden attribute.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  private readonly slotPresence = new SlotPresenceController(this);

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('model-select-list');
  private controlId = nextId('model-select-control');
  private popupPosition = new AnchoredPopoverController();
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private _value = '';
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  // Replacing the currently focused trigger/input during a mode switch fires
  // `blur` synchronously while Lit is rendering. That structural blur must not
  // mutate reactive touched/open state from inside the active update cycle.
  private suppressControlBlur = false;
  // What `form.reset()` restores to — captured from the `value` *content
  // attribute* only, mirroring native `<input>`/`FormAssociated`'s
  // `_defaultValue` (see internal/form-associated.ts). There's no child
  // markup here to seed a declarative default from (unlike lr-select's
  // `<lr-option selected>`), so the initial attribute is the only source.
  private _defaultValue = '';
  private _valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;

  constructor() {
    super();
    this.internals = attachLegacyNoopInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
    // Native <input> always has a submission value ("") from construction —
    // without this, a control whose `value` is never touched is entirely
    // absent from FormData instead of present as "" (see form-associated.ts).
    this.internals.setFormValue('');
  }

  /** Forwards to the internal trigger button (closed-dropdown mode) or combobox input (free-text
   *  mode) -- mirrors `<lr-button>`'s host `click()` forwarding so a generic form-automation
   *  helper or another component calling `.click()` on the host element actually opens the
   *  picker instead of silently doing nothing.
   *
   *  Closed-dropdown mode forwards via `.click()` itself, since the trigger is a real
   *  `<button>` wired to `@click`. Free-text mode instead calls `.focus()` on the input: unlike a
   *  genuine pointer click, `HTMLElement.click()` never moves focus (that's a mousedown side
   *  effect the browser applies only to *real* pointer interaction), and this control's open
   *  behavior for that mode is wired to the input's `focus` event (see `onInputFocus`), not a
   *  `click` handler on the input itself. */
  override click(): void {
    if (this.effectiveDisabled) return;
    const trigger = this.renderRoot?.querySelector('[part="trigger"]') as HTMLButtonElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    const input = this.renderRoot?.querySelector('[part="combobox-input"]') as HTMLInputElement | null;
    input?.click();
    input?.focus();
  }

  /** Focuses the active semantic control in both closed-dropdown and free-text modes. */
  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Blurs the active semantic control in both rendering modes. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  /** The native editable input in free-text mode, or `null` in closed-dropdown mode and before render. */
  get input(): HTMLInputElement | null {
    return this.renderRoot?.querySelector<HTMLInputElement>('[part="combobox-input"]') ?? null;
  }

  get selectionStart(): number | null {
    return this.input?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.input) this.input.selectionStart = value;
  }

  get selectionEnd(): number | null {
    return this.input?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.input) this.input.selectionEnd = value;
  }

  get selectionDirection(): LyraModelSelectSelectionDirection | null {
    return (this.input?.selectionDirection as LyraModelSelectSelectionDirection | undefined) ?? null;
  }

  set selectionDirection(value: LyraModelSelectSelectionDirection | null) {
    if (this.input) this.input.selectionDirection = value;
  }

  /** Selects all editable text in free-text mode; otherwise a no-op. */
  select(): void {
    this.input?.select();
  }

  /** Forwards the native selection range in free-text mode; otherwise a no-op. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraModelSelectSelectionDirection,
  ): void {
    this.input?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  /**
   * Applies a silent native range edit in free-text mode and synchronizes the committed value,
   * form entry, and validity. Closed-dropdown mode and pre-render calls are no-ops.
   */
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const input = this.input;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.query = input.value;
    this.activeIndex = -1;
    this.value = input.value;
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the browser-resolved owning form, including an external owner selected by `form`. */
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
    return this.renderRoot?.querySelector('[part="trigger"], [part="combobox-input"]') ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
    if (this.hasUpdated && this.open) queueMicrotask(() => this.syncPopup());
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    let modeChanged = false;
    if (this.hasUpdated) {
      const renderedClosedMode = this.renderRoot.querySelector('[part="trigger"]') !== null;
      modeChanged = renderedClosedMode !== this.closedMode;
      this.suppressControlBlur = modeChanged;
    }
    if (
      this.open &&
      (changed.has('catalog') || changed.has('value') || changed.has('allowCustom'))
    ) {
      this.activeIndex = -1;
      // A live catalog refresh changes the suggestions underneath the current draft, not the
      // draft itself. Rebase only for controlled-value changes or a structural mode switch;
      // otherwise a provider polling its model list would erase what the user is typing.
      if (changed.has('value') || changed.has('allowCustom') || modeChanged) {
        this.query = this.labelFor(this._value);
      }
    }
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  adoptedCallback(): void {
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
  }

  /** The current model id (empty string when nothing is selected). */
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    const old = this._value;
    if (!this.settingDefaultValue) this._valueDirty = true;
    this._value = next ?? '';
    this.internals.setFormValue(this._value);
    this.updateValidity();
    this.requestUpdate('value', old);
  }
  /** Reflected current reset default; changing it never overwrites a dirty live `value`. */
  get defaultValue(): string { return this._defaultValue; }
  set defaultValue(next: string) {
    if (this.reflectingDefaultValue) return;
    const old = this._defaultValue;
    this._defaultValue = next ?? '';
    this.reflectingDefaultValue = true;
    try {
      if (this._defaultValue) this.setAttribute('value', this._defaultValue);
      else this.removeAttribute('value');
    } finally {
      this.reflectingDefaultValue = false;
    }
    if (!this._valueDirty) this.restoreLiveValueFromDefault();
    this.requestUpdate('defaultValue', old);
  }

  /** The form submission key, reflected synchronously for native form APIs. */
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
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    // Disabling bars constraint validation, so the intrinsic violation has to be dropped with it --
    // synchronously, for the same reason the attribute is reflected synchronously.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

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

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /**
   * Shared with every other form control: own `disabled` and a `<fieldset disabled>` ancestor bar
   * constraint validation (this picker has no `readonly` of its own). A barred control matches
   * neither `:valid` nor `:invalid` natively, so leaving `valueMissing` raised on a disabled
   * required picker is what painted it red under the documented `:state(user-invalid)` rule.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && !this._value) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('modelSelectRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.publishValidityStates();
  }

  /** Republishes the six validity custom states. Driven from every place validity or interaction
   *  can move -- {@linkcode updateValidity}, `reportValidity()`, and `updated()` for `touched` --
   *  because this control drives `ElementInternals` directly rather than through the
   *  `FormAssociated` mixin, which does this for the controls that do use it. `touched` is the
   *  interaction flag: it flips on the trigger's/input's first blur, and on a `reportValidity()`
   *  call, which is what a submit attempt runs. */
  private publishValidityStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
  }

  formResetCallback(): void {
    this.touched = false;
    this.restoreLiveValueFromDefault();
  }
  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try { this.value = this._defaultValue; }
    finally { this.settingDefaultValue = false; }
    this._valueDirty = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.value = typeof state === 'string' ? state : '';
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    // A reportValidity() call is what a submit attempt runs, and it is the moment native controls
    // start matching :user-invalid -- so it counts as interaction here too. `touched` also gates
    // the data-invalid/aria-invalid reflection, which is the point: after a rejected submit the
    // control should read as invalid, not stay pristine.
    this.touched = true;
    this.publishValidityStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a server-side
   * rejection ("that model was retired by the provider") that no client-side constraint can
   * express. A non-empty `message` raises `customError` and becomes `validationMessage`, so the
   * control fails `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears
   * it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` picker with no value stays `valueMissing`. The custom error also survives every
   * intrinsic recomputation in between (each `value`/`required` change re-runs `updateValidity()`)
   * and a `form.reset()` — matching a native control, where only another `setCustomValidity('')`
   * clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.publishValidityStates();
  }

  /** `catalog`, normalized to `{ id, label }[]` regardless of the plain-string-array shorthand. */
  private get normalizedCatalog(): LyraModelCatalogEntry[] {
    return normalizeCatalog<LyraModelCatalogEntry>(this.catalog);
  }

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.normalizedCatalog.length > 0 && !this.allowCustom;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic
   * trailing row for it — recomputed from scratch on every access so it
   * always reflects the *current* `catalog`/`value`, never a snapshot from
   * whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    return withSyntheticCatalogValue(this.normalizedCatalog, this._value);
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id or label substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    return filterCatalogEntries(this.effectiveEntries, this.query, this.effectiveLocale, (entry) => [
      entry.id,
      entry.label,
    ]);
  }

  private labelFor(id: string): string {
    if (!id) return '';
    return this.effectiveEntries.find((e) => e.id === id)?.label ?? id;
  }

  private show(): void {
    if (this.open || this.effectiveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener) return;
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
    ownerDocument.addEventListener('pointerdown', listener);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener('pointerdown', this.pointerListener);
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private syncPopup(): void {
    this.popupPosition.disconnect();
    if (!this.open || !this.isConnected) {
      this.unbindDocumentPointer();
      return;
    }
    this.bindDocumentPointer();
    const anchor = this.renderRoot.querySelector(
      this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchor && listbox) this.popupPosition.reposition(anchor, listbox);
  }

  protected override updated(changed: PropertyValues): void {
    const reposition =
      changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    if (reposition) {
      this.syncPopup();
    }
    if (changed.has('required') || changed.has('touched') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    // Unconditional, unlike the data-invalid reflection above: it also has to run on the FIRST
    // update, so a control that is never touched still publishes `optional`/`valid` (or
    // `required`/`invalid`) for a consumer's :state() rule to match from the moment it mounts.
    this.publishValidityStates();
    this.suppressControlBlur = false;
  }

  private commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((e) => e.id === next);
    this.value = next;
    this.hide();
    this.emit('lr-change', { value: next, inCatalog });
    this.emitValueEvents();
  }

  /** Dispatches the platform-style value-event pair alongside `lr-change`,
   * mirroring `<lr-select>`/`<lr-combobox>` so native form bindings and
   * framework `v-model` handlers behave consistently across the picker
   * family. */
  private emitValueEvents(): void {
    dispatchNativeEvent(this, 'input');
    dispatchNativeEvent(this, 'change');
  }

  private selectEntry(entry: DisplayEntry): void {
    this.commitValue(entry.id);
  }

  /** Enter in free-text mode: commit the highlighted suggestion, else the raw typed text. */
  private commitFreeText(): void {
    const rows = this.filteredEntries;
    const active = rows[this.activeIndex];
    if (this.activeIndex >= 0 && active) {
      this.commitValue(active.id);
      return;
    }
    this.commitValue(this.query.trim());
  }

  // -- Closed-dropdown mode (trigger button) --------------------------------

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (event: FocusEvent): void => {
    if (this.suppressControlBlur) {
      event.stopImmediatePropagation();
      return;
    }
    // The trigger's own `disabled` state becoming true force-blurs it if it currently holds
    // focus -- a platform reaction, not a user interaction -- and can land synchronously inside
    // the very property write that disabled this control, so `effectiveDisabled` already reads
    // true here whenever this is that case. Marking `touched` for it risked reentering that
    // in-flight update for a state flip nothing observable needed (fr_asxOgk4UhNB07xevCWwFVQ).
    if (!this.effectiveDisabled) this.touched = true;
    this.hide();
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };
  private onTriggerFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };
  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    const rows = this.effectiveEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
      case ' ':
        if (this.open) {
          e.preventDefault();
          const active = rows[this.activeIndex];
          if (this.activeIndex >= 0 && active) {
            this.selectEntry(active);
          } else {
            this.hide();
          }
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Free-text mode (text input) ------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    e.preventDefault();
    (this.renderRoot.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  };
  private onInputFocus = (event: FocusEvent): void => {
    // Seed the editable text from the *current* value each time a fresh
    // editing session starts, not on every keystroke (onInput overwrites
    // `query` directly) — otherwise a same-session reopen via ArrowDown
    // after Escape would clobber the just-reverted text right back to
    // whatever the user had typed before Escape.
    if (!this.open) this.query = this.labelFor(this.value);
    this.show();
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };
  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    relayNativeEvent(this, e);
  };
  private onInputBlur = (event: FocusEvent): void => {
    if (this.suppressControlBlur) {
      event.stopImmediatePropagation();
      return;
    }
    // Same disabled-forced-blur guard as onTriggerBlur above -- the combobox input's own
    // `disabled` state becoming true auto-blurs it if it currently holds focus, a platform
    // reaction rather than user interaction (fr_asxOgk4UhNB07xevCWwFVQ).
    if (!this.effectiveDisabled) this.touched = true;
    this.hide();
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };
  private onInputKeyDown = (e: KeyboardEvent): void => {
    const rows = this.filteredEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
        if (this.open) {
          e.preventDefault();
          this.commitFreeText();
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.query = this.labelFor(this.value);
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Shared listbox ---------------------------------------------------

  // Delegated onto [part="listbox"] rather than one closure pair allocated
  // per row per render — resolves the target row via closest('[part="option"]')
  // + a data-value lookup, mirroring lr-select/lr-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset['value'];
    if (value === undefined) return;
    const entry = (this.closedMode ? this.effectiveEntries : this.filteredEntries).find((e2) => e2.id === value);
    if (entry) this.selectEntry(entry);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this._value;
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        ${entry.icon ? html`<span part="option-icon" aria-hidden="true">${entry.icon}</span>` : nothing}
        <span part="option-label">${entry.label}</span>
        ${entry.synthetic ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>` : ''}
      </div>`;
    });
  }

  private renderListbox(rows: DisplayEntry[], activeId: string, emptyText: string): TemplateResult {
    return html`
      <div
        part="listbox"
        id=${this.listId}
        role="listbox"
        @mousedown=${this.onListboxMouseDown}
        @click=${this.onListboxClick}
      >
        ${rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : this.renderRows(rows, activeId)}
      </div>
    `;
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private get hasVisibleLabel(): boolean {
    return this.label.length > 0 || this.slotPresence.has('label');
  }

  /** `part="form-control-label"` — see `label`'s doc comment for host `aria-label` precedence. */
  private renderLabel(): TemplateResult {
    return html`<label part="form-control-label" for=${this.controlId} ?hidden=${!this.hasVisibleLabel}
      >${this.label}<slot name="label"></slot></label
    >`;
  }

  /** `part="hint"`/`part="error"` — mirrors `lr-select`'s identical hint/error chrome, rendered
   *  identically in both closed-dropdown and free-text mode. */
  private renderHintError(hasError: boolean, hasHint: boolean): TemplateResult {
    return html`
      <div id="model-select-error" part="error" ?hidden=${!hasError}>
        ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
      </div>
      <div id="model-select-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
      </div>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this._value.length > 0;
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'model-select-error' : '', hasHint ? 'model-select-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <button
        id=${this.controlId}
        part="trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${this.listId}
        aria-activedescendant=${activeId}
        aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('model'))}
        aria-describedby=${describedBy || nothing}
        aria-required=${this.required ? 'true' : 'false'}
        aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeyDown}
        @focus=${this.onTriggerFocus}
        @blur=${this.onTriggerBlur}
      >
        ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
        <span class="trigger-label" ?data-placeholder=${!hasValue}
          >${hasValue ? this.labelFor(this._value) : this.placeholder}</span
        >
        <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
      </button>
      ${this.renderListbox(rows, activeId, this.localize('modelSelectNoModels'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'model-select-error' : '', hasHint ? 'model-select-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <div part="combobox" @mousedown=${this.onComboMouseDown}>
        ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
        <input
          id=${this.controlId}
          part="combobox-input"
          role="combobox"
          aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('model'))}
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-autocomplete="list"
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          autocomplete=${this.autocomplete || nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          .value=${this.open ? this.query : this.labelFor(this._value)}
          placeholder=${this.placeholder}
          ?disabled=${this.effectiveDisabled}
          @input=${this.onInput}
          @keydown=${this.onInputKeyDown}
          @focus=${this.onInputFocus}
          @blur=${this.onInputBlur}
        />
        <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
      </div>
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  override render(): TemplateResult {
    return html`<div part="form-control">
      ${this.closedMode ? this.renderClosed() : this.renderFreeText()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-model-select': LyraModelSelect;
  }
}
