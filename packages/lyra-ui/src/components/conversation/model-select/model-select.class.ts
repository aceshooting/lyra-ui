import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isComposedFocusAvailable,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { styles } from './model-select.styles.js';
import { spellcheckFromAttributeConverter as spellcheckConverter } from '../../../internal/converters.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import {
  CatalogPickerController,
  type LyraCatalog,
  type LyraCatalogEntry,
  type DisplayCatalogEntry,
} from '../../../internal/catalog-picker.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_model, LYRA_DEFAULT_modelSelectNoModels, LYRA_DEFAULT_modelSelectRequired, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraCatalog, LyraCatalogEntry } from '../../../internal/catalog-picker.js';

/** A catalog row: a selectable model, keyed by `id` with a display `label`. */
export interface LyraModelCatalogEntry extends LyraCatalogEntry {
  /** Optional literal icon hint (for example, an emoji), rendered decoratively before `label`. */
  icon?: string;
}

/** Direction reported by the free-text input's native selection APIs. */
export type LyraModelSelectSelectionDirection = LyraSelectionDirection;

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
type DisplayEntry = DisplayCatalogEntry<LyraModelCatalogEntry>;

export interface LyraModelSelectEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  input: Event;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
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
 * A focused trigger/input follows a rendering-mode replacement. If that new owner is disabled or
 * inert, focus returns to the available element that led into the picker, or to the stable
 * `form-control` owner when there is no return target; a newer external focus move always wins.
 * Array-valued catalogs are clone-owned, bounded readonly snapshots. Create and reassign a new
 * catalog array after changing its rows.
 *
 * @customElement lr-model-select
 * @event lr-change - The selected/typed value changed. `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Owner-realm native event fired alongside `lr-change`, mirroring
 *   `<lr-select>`/`<lr-combobox>`'s value-change pair so native form bindings/framework `v-model`
 *   handlers behave consistently across the picker family.
 * @event {Event} input - A payload-preserving owner-realm `InputEvent` on each free-text edit, and
 *   a plain native `Event` alongside `change` when either rendering mode commits a value.
 * @event {FocusEvent} blur - Owner-realm native blur relayed once from the active control in either
 *   rendering mode, retaining `relatedTarget`.
 * @event {FocusEvent} focus - Owner-realm native focus relayed once from the active control in
 *   either rendering mode, retaining `relatedTarget`.
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

  protected static override readonly ownedCollectionProperties = Object.freeze(['catalog']);

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
  /** The clone-owned full model list. Omit (or leave empty) to fall back to plain free-text entry.
   *  Catalog ids must be nonempty and unique; malformed rows and later duplicates are omitted,
   *  first wins. Reassign a new array after changes. */
  @property({ attribute: false }) catalog?: LyraCatalog<LyraModelCatalogEntry>;
  /** Let the user type/commit a value that isn't in `catalog`, even when `catalog` is non-empty. */
  @property({ type: Boolean, reflect: true, attribute: 'allow-custom' }) allowCustom = false;
  /** Keeps user edits and catalog commits from changing `value` while retaining focus, popup
   *  navigation, selection/copy, form submission, reset, and programmatic writes. */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
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
  /** Whether the model list is open. Effectively disabled controls reject direct reopen attempts,
   * including a synchronous fieldset cascade. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean { return this.catalogPicker.open; }
  set open(next: boolean) {
    this.catalogPicker.setOpen(next);
  }
  /** Visual size, on the library-wide six-step ladder (`2xs`–`xl`). `small`/`medium`/`large` are
   *  accepted spellings of `s`/`m`/`l` and render identically, so markup migrated from Web Awesome
   *  or Shoelace needs no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';

  private get activeIndex(): number { return this.catalogPicker.activeIndex; }
  // Free-text mode's live input text. Only meaningful while `open` — the
  // input is otherwise controlled by the committed value's label (see
  // `renderFreeText`), so this never needs resetting on commit/hide.
  private get query(): string { return this.catalogPicker.query; }
  // Set on first blur; gates the `data-invalid` reflection below so
  // validity styling never flashes on first render (matches lr-select).
  @state() private touched = false;
  // `[part]:empty` never matches because each wrapper contains a literal slot. The shared
  // controller keeps label/hint/error presence hydration-safe and progressively visible in SSR.
  private readonly slotPresence = new SlotPresenceController(this);

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private listId = nextId('model-select-list');
  private controlId = nextId('model-select-control');
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  // Replacing the currently focused trigger/input during a mode switch fires
  // `blur` synchronously while Lit is rendering. That structural blur must not
  // mutate reactive touched/open state from inside the active update cycle.
  private suppressControlBlur = false;
  private modeFocusRepair?: ComposedFocusRepairSnapshot;
  private focusedModeRepair?: ComposedFocusRepairSnapshot;
  private focusReturnTarget?: HTMLElement;
  private readonly catalogPicker = new CatalogPickerController<LyraModelCatalogEntry>(this, {
    catalog: () => this.catalog,
    allowCustom: () => this.allowCustom,
    isReadonly: () => this.readonly,
    locale: () => this.effectiveLocale,
    searchableFields: (entry) => [entry.id, entry.label],
    emitChange: (detail) => this.emit('lr-change', detail),
    onValueChange: (value, oldValue) => {
      this.internals.setFormValue(value);
      this.updateValidity();
      this.requestUpdate('value', oldValue);
    },
    onDefaultValueChange: (_value, oldValue) => this.requestUpdate('defaultValue', oldValue),
    onStateChange: (state, oldValue) => {
      if (state === 'open') this.requestUpdate('open', oldValue);
      else this.requestUpdate();
    },
    onControlFocus: (event) => this.captureModeFocus(event),
    onControlBlur: (event) => {
      if (!this.effectiveDisabled) this.touched = true;
      this.retireModeFocusAfterBlur(event);
    },
    forwardFreeInputClick: true,
  });

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
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
   *  `<button>` wired to `@click`. Free-text mode forwards `.click()` to the input, then explicitly
   *  calls `.focus()`: unlike a genuine pointer click, `HTMLElement.click()` never moves focus
   *  (that's a mousedown side effect the browser applies only to *real* pointer interaction), and
   *  this control's open behavior for that mode is wired to the input's `focus` event (see
   *  `onInputFocus`), not a `click` handler on the input itself. */
  override click(): void {
    this.catalogPicker.click();
  }

  /** Focuses the active semantic control in both closed-dropdown and free-text modes. */
  override focus(options?: FocusOptions): void {
    this.catalogPicker.focus(options);
  }

  /** Blurs the active semantic control in both rendering modes. */
  override blur(): void {
    this.catalogPicker.blur();
  }

  /** The native editable input in free-text mode, or `null` in closed-dropdown mode and before render. */
  get input(): HTMLInputElement | null {
    return this.catalogPicker.input;
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
    this.catalogPicker.select();
  }

  /** Forwards the native selection range in free-text mode; otherwise a no-op. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraModelSelectSelectionDirection,
  ): void {
    this.catalogPicker.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  /**
   * Applies a silent native range edit in free-text mode and synchronizes the committed value,
   * form entry, and validity. Closed-dropdown mode and pre-render calls are no-ops.
   */
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    this.catalogPicker.setRangeText(replacement, start, end, selectMode);
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
    this.catalogPicker.connected(this.hasUpdated);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    let modeChanged = false;
    if (this.hasUpdated) {
      const renderedControl = this.renderRoot.querySelector<HTMLElement>(
        '[part="trigger"], [part="combobox-input"]',
      );
      const renderedClosedMode = renderedControl?.getAttribute('part') === 'trigger';
      modeChanged = renderedClosedMode !== this.closedMode;
      this.suppressControlBlur = modeChanged;
      this.catalogPicker.suppressControlEvents = modeChanged;
      this.modeFocusRepair =
        modeChanged && renderedControl !== null && activeElementIn(this.shadowRoot) === renderedControl
          ? captureComposedFocusRepair(
            this,
            this.modeFocusFallback() ?? renderedControl,
          ) ?? undefined
          : modeChanged
            ? this.focusedModeRepair
            : undefined;
    }
    if (
      this.open &&
      (changed.has('catalog') || changed.has('value') || changed.has('allowCustom'))
    ) {
      // A live catalog refresh changes the suggestions underneath the current draft, not the
      // draft itself. Rebase only for controlled-value changes or a structural mode switch;
      // otherwise a provider polling its model list would erase what the user is typing.
      this.catalogPicker.reconcileRows(
        undefined,
        changed.has('value') || changed.has('allowCustom') || modeChanged,
        false,
      );
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.modeFocusRepair = undefined;
    this.focusedModeRepair = undefined;
    this.focusReturnTarget = undefined;
    this.catalogPicker.disconnected();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.modeFocusRepair = undefined;
    this.focusedModeRepair = undefined;
    this.focusReturnTarget = undefined;
    this.catalogPicker.adopted();
  }

  /** The current model id (empty string when nothing is selected). */
  get value(): string {
    return this.catalogPicker.value;
  }
  set value(next: string) {
    this.catalogPicker.value = next;
  }
  /** Reflected current reset default; changing it never overwrites a dirty live `value`. */
  get defaultValue(): string { return this.catalogPicker.defaultValue; }
  set defaultValue(next: string) {
    this.catalogPicker.defaultValue = next;
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
   * Shared with every other form control: own `disabled`/`readonly` and a `<fieldset disabled>`
   * ancestor bar constraint validation. A barred control matches
   * neither `:valid` nor `:invalid` natively, so leaving `valueMissing` raised on a disabled
   * required picker is what painted it red under the documented `:state(user-invalid)` rule.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && !this.value) {
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
    this.catalogPicker.resetValue();
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.catalogPicker.restoreState(state);
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

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.catalogPicker.closedMode;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic
   * trailing row for it — recomputed from scratch on every access so it
   * always reflects the *current* `catalog`/`value`, never a snapshot from
   * whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    return this.catalogPicker.effectiveEntries;
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id or label substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    return this.catalogPicker.filteredEntries;
  }

  private labelFor(id: string): string {
    return this.catalogPicker.labelFor(id);
  }

  private show(): void {
    this.catalogPicker.show();
  }
  private hide(): void {
    this.catalogPicker.hide();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const reposition =
      changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    this.catalogPicker.updated(reposition);
    if (
      changed.has('required') ||
      changed.has('readonly') ||
      changed.has('touched') ||
      changed.has('value')
    ) {
      if (changed.has('readonly')) this.updateValidity();
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    // Unconditional, unlike the data-invalid reflection above: it also has to run on the FIRST
    // update, so a control that is never touched still publishes `optional`/`valid` (or
    // `required`/`invalid`) for a consumer's :state() rule to match from the moment it mounts.
    this.publishValidityStates();
    this.suppressControlBlur = false;
    this.catalogPicker.suppressControlEvents = false;
    const focusRepair = this.modeFocusRepair;
    this.modeFocusRepair = undefined;
    if (focusRepair) {
      this.scheduleAfterUpdate(() => {
        const replacement = this[VALIDITY_ANCHOR]();
        const target = replacement && isComposedFocusAvailable(replacement)
          ? replacement
          : this.modeFocusFallback();
        applyComposedFocusRepair(focusRepair, target);
        if (this.focusedModeRepair === focusRepair) this.focusedModeRepair = undefined;
      }, 'model-select-mode-focus');
    }
  }

  private rememberFocusReturn(event: FocusEvent): void {
    const related = event.relatedTarget;
    if (related && (related as Node).nodeType === 1 && isComposedFocusAvailable(related as Element)) {
      this.focusReturnTarget = related as HTMLElement;
    }
  }

  private captureModeFocus(event: FocusEvent): void {
    this.rememberFocusReturn(event);
    const control = event.currentTarget;
    if (!control || (control as Node).nodeType !== 1) return;
    this.focusedModeRepair = captureComposedFocusRepair(
      this,
      this.modeFocusFallback() ?? control as HTMLElement,
    ) ?? undefined;
  }

  private retireModeFocusAfterBlur(event: FocusEvent): void {
    const destination = event.relatedTarget;
    if (destination && (destination as Node).nodeType === 1) {
      this.focusedModeRepair = undefined;
      return;
    }
    queueMicrotask(() => {
      if (!this.suppressControlBlur && !this.effectiveDisabled && !this.hasAttribute('inert')) {
        this.focusedModeRepair = undefined;
      }
    });
  }

  private modeFocusFallback(): HTMLElement | null {
    if (this.focusReturnTarget && isComposedFocusAvailable(this.focusReturnTarget)) {
      return this.focusReturnTarget;
    }
    const owner = this.renderRoot.querySelector<HTMLElement>('[part="form-control"]');
    return owner && isComposedFocusAvailable(owner) ? owner : null;
  }

  // -- Closed-dropdown mode (trigger button) --------------------------------

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (event: FocusEvent): void => {
    this.catalogPicker.handleControlBlur(event);
  };
  private onTriggerFocus = (event: FocusEvent): void => {
    this.catalogPicker.handleControlFocus(event);
  };
  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    this.catalogPicker.handleTriggerKeyDown(e);
  };

  // -- Free-text mode (text input) ------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    this.catalogPicker.handleComboMouseDown(e);
  };
  private onInputFocus = (event: FocusEvent): void => {
    this.catalogPicker.handleInputFocus(event);
  };
  private onInput = (e: Event): void => {
    this.catalogPicker.handleInput(e);
  };
  private onInputBlur = (event: FocusEvent): void => {
    this.catalogPicker.handleControlBlur(event);
  };
  private onInputKeyDown = (e: KeyboardEvent): void => {
    this.catalogPicker.handleInputKeyDown(e);
  };

  // -- Shared listbox ---------------------------------------------------

  // Delegated onto [part="listbox"] rather than one closure pair allocated
  // per row per render — resolves the target row via closest('[part="option"]')
  // + a data-value lookup, mirroring lr-select/lr-combobox.
  private onListboxMouseDown = (e: MouseEvent): void => {
    this.catalogPicker.handleListboxMouseDown(e);
  };
  private onListboxClick = (e: MouseEvent): void => {
    this.catalogPicker.handleListboxClick(e);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this.value;
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        ${entry.icon ? html`<span part="option-icon" aria-hidden="true" inert>${entry.icon}</span>` : nothing}
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

  private get hasVisibleLabel(): boolean {
    return (this.label ?? '').length > 0 || this.slotPresence.has('label');
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
        ${this.errorText}<slot name="error"></slot>
      </div>
      <div id="model-select-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint"></slot>
      </div>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this.value.length > 0;
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError = this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
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
        aria-label=${hostAriaLabel(this) ?? (hasLabel ? nothing : this.placeholder || this.localize('model'))}
        aria-describedby=${describedBy || nothing}
        aria-required=${this.required ? 'true' : 'false'}
        aria-readonly=${this.readonly ? 'true' : 'false'}
        aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
        ?disabled=${this.effectiveDisabled}
        @click=${this.onTriggerClick}
        @keydown=${this.onTriggerKeyDown}
        @focus=${this.onTriggerFocus}
        @blur=${this.onTriggerBlur}
      >
        ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
        <span class="trigger-label" ?data-placeholder=${!hasValue}
          >${hasValue ? this.labelFor(this.value) : this.placeholder}</span
        >
        <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
      </button>
      ${this.renderListbox(rows, activeId, this.localize('modelSelectNoModels'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.hasVisibleLabel;
    const hasHint = this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError = this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
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
          aria-label=${hostAriaLabel(this) ?? (hasLabel ? nothing : this.placeholder || this.localize('model'))}
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-autocomplete="list"
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-readonly=${this.readonly ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          autocomplete=${this.autocomplete || nothing}
          spellcheck=${this.spellcheck}
          autocapitalize=${this.autocapitalize || nothing}
          autocorrect=${this.autoCorrect || nothing}
          inputmode=${this.inputMode || nothing}
          enterkeyhint=${this.enterKeyHint || nothing}
          .value=${this.open ? this.query : this.labelFor(this.value)}
          .readOnly=${this.readonly}
          placeholder=${this.placeholder}
          ?disabled=${this.effectiveDisabled}
          @input=${this.onInput}
          @keydown=${this.onInputKeyDown}
          @focus=${this.onInputFocus}
          @blur=${this.onInputBlur}
        />
        <span part="expand-icon" aria-hidden="true" inert>${chevronIcon()}</span>
      </div>
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  override render(): TemplateResult {
    return html`<div part="form-control" tabindex="-1">
      ${this.closedMode ? this.renderClosed() : this.renderFreeText()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-model-select': LyraModelSelect;
  }
}
