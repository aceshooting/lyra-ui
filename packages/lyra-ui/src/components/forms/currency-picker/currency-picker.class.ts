import { nothing, type PropertyValues, type ReactiveController, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { tag } from '../../../internal/prefix.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { styleMap } from 'lit/directives/style-map.js';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation, type FormValueAdapter, type FormSubmissionValue } from '../../../internal/form-associated.js';
import { resolveValidityAnchor, SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { acquireResolvedAriaRelationship, type ResolvedAriaRelationshipLease } from '../../../internal/aria-controls.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import type { PlaceStrategy } from '../../../internal/positioner.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraSelect } from '../select/select.class.js';
import '../select/select.class.js';
import '../combobox/option.class.js';
import { styles } from './currency-picker.styles.js';
import { DEFAULT_CURRENCY_ENTRIES, normalizeCurrencyCatalog, normalizeCurrencyValue } from './currency-catalog.js';
import { resolveCurrencyPresentation, type ResolvedCurrencyEntry } from './currency-presentation.js';
import type { LyraCurrencyCatalog, LyraCurrencyEntry } from './currency-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_currencyPickerLabel, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraCurrencyCatalog, LyraCurrencyEntry } from './currency-types.js';

export interface LyraCurrencyChangeDetail {
  readonly value: string;
  readonly previousValue: string;
}
export interface LyraCurrencyPickerEventMap {
  'lr-input': CustomEvent<LyraCurrencyChangeDetail>;
  'lr-change': CustomEvent<LyraCurrencyChangeDetail>;
  'lr-invalid': CustomEvent<null>;
  input: Event;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
}
const valueAdapter: FormValueAdapter<string> = {
  empty: '', toFormValue: (value) => value, fromAttribute: normalizeCurrencyValue,
  toAttribute: normalizeCurrencyValue, fromFormState: (state) => normalizeCurrencyValue(state),
};
class CurrencyPickerBase extends LyraElement<LyraCurrencyPickerEventMap> {}

/**
 * `<lr-currency-picker>` — a form-associated currency-code selector.
 *
 * The trigger shows the committed ISO code; options pair code-only type-ahead with localized
 * names and symbols. Omission uses a pinned catalog of 176 currency, fund and metal codes.
 * Supply `currencies` for an ordered application subset or literal display overrides.
 *
 * Empty values remain uncommitted. Unknown, malformed and subsequently disabled values remain
 * visible and invalid until replaced or cleared. Programmatic changes, catalog updates, locale
 * changes and form reset are silent. A user commit emits input, lr-input, change and lr-change
 * exactly once, after the value and outer form state have changed.
 *
 * The outer field owns form submission, defaults and validation. The composed select supplies
 * supported keyboard, popup and field chrome behavior. Selection does not convert amounts,
 * persist a preference, fetch exchange rates or change the page locale.
 *
 * @customElement lr-currency-picker
 * @slot label - Custom field label.
 * @slot hint - Custom field guidance.
 * @slot error - Custom validation guidance.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The select trigger.
 * @csspart select-display-input - The selected currency code.
 * @csspart select-listbox - The currency listbox.
 * @csspart select-option - A currency option.
 * @csspart select-option-sub - The option descriptive subtext.
 * @csspart select-clear-button - The optional clear action.
 * @csspart hint - Field guidance.
 * @csspart error - Validation guidance.
 * @event {Event} input - Fired after a user selection updates the committed value and form state.
 * @event lr-input - User selection changed the committed value.
 * @event {Event} change - Fired once after an accepted user selection or clear.
 * @event lr-change - User selection changed the committed value.
 * @event lr-invalid - Native invalid alias. Cancelable: preventDefault() suppresses validation UI.
 * @event {FocusEvent} focus - Re-dispatched from the visible control as a bubbling, composed event.
 * @event {FocusEvent} blur - Re-dispatched from the visible control as a bubbling, composed event.
 * @status experimental
 * @since unreleased
 */
export class LyraCurrencyPicker extends FormAssociated(CurrencyPickerBase, valueAdapter) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    currencyPickerLabel: LYRA_DEFAULT_currencyPickerLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = collectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-input', 'lr-change']);
  /** Visible field label; the label slot takes precedence. */
  @property() label = '';
  /** Field guidance; the hint slot takes precedence. */
  @property() hint = '';
  /** Static error guidance; the error slot takes precedence. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Empty display text. Omission localizes Select; explicit empty text stays empty. */
  @property() placeholder: string | undefined;
  /** Host aria-label override, taking precedence over labels and aria-labelledby. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Shared form-control size. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Show the supported select clear action for a nonempty value. */
  @property({ type: Boolean }) clearable = false;
  /** Place the popup in the browser top layer, including within native dialogs. */
  @property({ type: Boolean, attribute: 'top-layer' }) topLayer = false;
  /** Explicit popup strategy; omission inherits --lr-positioning-strategy. */
  @property({ attribute: 'positioning-strategy' }) positioningStrategy?: PlaceStrategy;
  @query(tag('select')) private selectElement?: LyraSelect<false>;
  private readonly slotPresence = new SlotPresenceController(this);
  private descriptionLease?: ResolvedAriaRelationshipLease;
  private labelLease?: ResolvedAriaRelationshipLease;
  private validationChild?: LyraSelect<false>;
  private validationDocument?: Document;
  private readonly validationController: ReactiveController = { hostUpdated: () => this.projectValidation() };
  constructor() {
    super();
    this.addEventListener('invalid', () => this.projectValidation());
  }
  private projectValidation(): void {
    const child = this.validationChild;
    if (!child || !this.isConnected || child !== this.selectElement || this.validationDocument !== this.ownerDocument) return;
    resolveValidityAnchor(child)?.setAttribute('aria-invalid', this.internals.states?.has('user-invalid') ? 'true' : 'false');
  }
  private projectionToken = 0;
  private projectedAnchor?: HTMLElement;
  private _currencies: readonly LyraCurrencyEntry[] | undefined;
  private presentationEntries?: readonly LyraCurrencyEntry[];
  private presentationLocale?: string;
  private presentationRows?: readonly ResolvedCurrencyEntry[];
  /** Clone-owned, bounded catalog snapshot. Undefined/null restores defaults; [] stays empty. */
  @property({ attribute: false })
  get currencies(): LyraCurrencyCatalog | undefined { return this._currencies; }
  set currencies(next: LyraCurrencyCatalog | undefined) {
    const previous = this._currencies;
    this._currencies = normalizeCurrencyCatalog(next);
    this.updateValidity();
    this.requestUpdate('currencies', previous);
  }
  /** Committed code, empty by default. Normalizes three ASCII letters; retains malformed text. */
  override get value(): string { return super.value; }
  override set value(next: string) { super.value = normalizeCurrencyValue(next); }
  /** Normalized value restored by native form reset and value-attribute changes. */
  override get defaultValue(): string { return normalizeCurrencyValue(super.defaultValue); }
  override set defaultValue(next: string) { super.defaultValue = next; }
  private get entries(): readonly LyraCurrencyEntry[] { return this._currencies ?? DEFAULT_CURRENCY_ENTRIES; }
  private get rows(): readonly ResolvedCurrencyEntry[] {
    const entries = this.entries;
    const locale = this.effectiveLocale;
    if (this.presentationEntries !== entries || this.presentationLocale !== locale || !this.presentationRows) {
      this.presentationEntries = entries;
      this.presentationLocale = locale;
      this.presentationRows = resolveCurrencyPresentation(entries, locale);
    }
    return this.presentationRows;
  }
  private get unavailable(): boolean {
    return Boolean(this.value && !this.entries.some((row) => row.code === this.value && !row.disabled));
  }
  protected updateValidity(): void {
    if (!this.internals) return;
    if (isBarredFromValidation(this, this.internals)) this[SET_ANCHORED_VALIDITY]({});
    else if (this.unavailable) this[SET_ANCHORED_VALIDITY]({ customError: true }, this.localize('notInCatalog'));
    else if (this.required && !this.value) this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
    else this[SET_ANCHORED_VALIDITY]({});
  }
  /** @internal Anchor validation to the composed select's focusable semantic owner. */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return resolveValidityAnchor(this.selectElement) ?? null;
  }
  /** Focus the composed trigger when enabled. */
  override focus(options?: FocusOptions): void { if (!this.effectiveDisabled) this.selectElement?.focus(options); }
  /** Blur the composed trigger. */
  override blur(): void { this.selectElement?.blur(); }
  /** Activate the composed trigger when enabled. */
  override click(): void { if (!this.effectiveDisabled) this.selectElement?.click(); }
  private readonly onChildChange = (event: Event): void => {
    if (event.target !== this.selectElement) return;
    event.stopPropagation();
    if (event.type !== 'lr-change' || this.effectiveDisabled) return;
    const next = (event as CustomEvent<{ value: string }>).detail.value;
    const previousValue = this.value;
    if (next === previousValue || (next && !this.entries.some((row) => row.code === next && !row.disabled))) return;
    this.value = next;
    const detail = { value: this.value, previousValue };
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', detail);
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', detail);
  };
  private readonly onChildFocus = (event: FocusEvent): void => {
    if (event.target !== this.selectElement) return;
    event.stopPropagation();
    relayNativeEvent(this, event);
  };
  private syncRelationships(): void {
    const anchor = this[VALIDITY_ANCHOR]();
    if (this.descriptionLease) this.descriptionLease.update(anchor);
    else this.descriptionLease = acquireResolvedAriaRelationship(this, anchor, 'aria-describedby');
    if (this.accessibleLabel !== null) { this.labelLease?.release(); this.labelLease = undefined; }
    else if (this.labelLease) this.labelLease.update(anchor);
    else this.labelLease = acquireResolvedAriaRelationship(this, anchor, 'aria-labelledby');
    if (anchor && this.projectedAnchor !== anchor) {
      this.projectedAnchor = anchor;
      this.requestUpdate();
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const child = this.selectElement;
    if (changed.has('positioningStrategy')) child?.requestUpdate('positioningStrategy');
    if (this.validationChild !== child || this.validationDocument !== this.ownerDocument) {
      this.validationChild?.removeController(this.validationController);
      this.validationChild = child;
      this.validationDocument = this.ownerDocument;
      child?.addController(this.validationController);
    }
    this.projectValidation();
    const token = ++this.projectionToken;
    const document = this.ownerDocument;
    if (!child) return;
    void child.updateComplete.then(() => {
      if (token === this.projectionToken && this.isConnected && this.ownerDocument === document && this.selectElement === child) {
        this.syncRelationships();
      }
    });
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.requestUpdate();
  }
  override formResetCallback(): void {
    super.formResetCallback();
    this.projectValidation();
  }
  override formStateRestoreCallback(state: FormSubmissionValue, reason: 'autocomplete' | 'restore'): void {
    super.formStateRestoreCallback(state, reason);
    this.projectValidation();
  }
  override disconnectedCallback(): void {
    ++this.projectionToken;
    if (this.selectElement) this.selectElement.open = false;
    this.validationChild?.removeController(this.validationController);
    this.validationChild = undefined;
    this.validationDocument = undefined;
    this.projectedAnchor = undefined;
    this.presentationEntries = undefined;
    this.presentationLocale = undefined;
    this.presentationRows = undefined;
    this.descriptionLease?.release(); this.descriptionLease = undefined;
    this.labelLease?.release(); this.labelLease = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const hasLabel = Boolean(this.label) || this.slotPresence.has('label');
    const selectTag = unsafeStatic(tag('select'));
    const optionTag = unsafeStatic(tag('option'));
    return html`<${selectTag}
      exportparts="form-control,form-control-label,trigger:select-trigger,display-input:select-display-input,listbox:select-listbox,option:select-option,option-sub:select-option-sub,clear-button:select-clear-button,hint,error"
      style=${styleMap({ '--lr-positioning-strategy': this.positioningStrategy === 'fixed' || this.positioningStrategy === 'absolute' ? this.positioningStrategy : undefined })}
      .strings=${this.strings}
      .customError=${this.validity.valid ? null : this.validationMessage}
      .value=${this.value} .label=${this.label} .hint=${this.hint} .errorText=${this.errorText}
      .placeholder=${this.placeholder ?? this.localize('select')}
      aria-label=${this.accessibleLabel ?? (hasLabel ? nothing : this.localize('currencyPickerLabel'))}
      .required=${this.required} .disabled=${this.effectiveDisabled} .size=${this.size}
      .clearable=${this.clearable} .topLayer=${this.topLayer}
      @input=${this.onChildChange} @lr-input=${this.onChildChange}
      @change=${this.onChildChange} @lr-change=${this.onChildChange}
      @focus=${this.onChildFocus} @blur=${this.onChildFocus}
    >${this.rows.map((row) => html`<${optionTag} .value=${row.code} .label=${row.code}
      .sub=${[row.label, row.symbol].filter((text) => text.length > 0).join(' · ')}
      .disabled=${Boolean(row.disabled)}>${row.code}</${optionTag}>`)}
      ${this.slotPresence.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing}
      ${this.slotPresence.has('hint') ? html`<slot name="hint" slot="hint"></slot>` : nothing}
      ${this.slotPresence.has('error') ? html`<slot name="error" slot="error"></slot>` : nothing}
      ${this.entries.some((row) => row.code === this.value && row.disabled) ? html`<span slot="end">${this.localize('notInCatalog')}</span>` : nothing}
    </${selectTag}>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-currency-picker': LyraCurrencyPicker; } }
