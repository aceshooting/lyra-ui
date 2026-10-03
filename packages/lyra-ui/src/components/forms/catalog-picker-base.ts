import { noChange, nothing, type PropertyValues, type ReactiveController, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation, type FormSubmissionValue } from '../../internal/form-associated.js';
import { resolveValidityAnchor, SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { acquireResolvedAriaRelationship, type ResolvedAriaRelationshipLease } from '../../internal/aria-controls.js';
import { collectionSupport } from '../../internal/collection-snapshot.js';
import { autocorrectConverter, spellcheckConverter } from '../../internal/converters.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../internal/native-event-relay.js';
import { activeElementIn, deepActiveElementIn } from '../../internal/active-element.js';
import { submitOnEnter } from '../../internal/submit-on-enter.js';
import { SlotPresenceController } from '../../internal/slot-presence-controller.js';
import { tag } from '../../internal/prefix.js';
import { normalizeSelectionValue, type SelectionCatalogEntry, type SelectionCatalogRow } from '../../internal/selection-catalog.js';
import type { PlaceStrategy } from '../../internal/positioner.js';
import type { LyraSize } from '../../internal/variants.js';
import type { LyraSelect } from './select/select.class.js';
import type { LyraCombobox } from './combobox/combobox.class.js';
import './select/select.class.js';
import './combobox/combobox.class.js';
import './combobox/option.class.js';
import { styles } from './catalog-picker-base.styles.js';

export interface LyraCatalogPickerChangeDetail {
  readonly value: string;
  readonly previousValue: string;
}

export interface LyraCatalogPickerEventMap {
  'lr-input': CustomEvent<LyraCatalogPickerChangeDetail>;
  'lr-change': CustomEvent<LyraCatalogPickerChangeDetail>;
  'lr-invalid': CustomEvent<null>;
  input: Event;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
}

type PickerControl = LyraSelect<false> | LyraCombobox<false>;
class CatalogPickerElement extends LyraElement<LyraCatalogPickerEventMap> {}
const pickerSpellcheckConverter = {
  ...spellcheckConverter,
  fromAttribute: (value: string | null): boolean => value === null ? false : spellcheckConverter.fromAttribute!(value, Boolean),
};

/** Shared implementation for catalog selectors; not a registered custom element. */
export abstract class LyraCatalogPickerBase extends FormAssociated(CatalogPickerElement) {
  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = collectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-input', 'lr-change']);
  /** Visible field label; the label slot takes precedence. */
  @property() label = '';
  /** Field guidance; the hint slot takes precedence. */
  @property() hint = '';
  /** Validation guidance; the error slot takes precedence. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Empty display text; omission localizes Select, while an explicit empty string stays empty. */
  @property() placeholder?: string;
  /** Host naming override, taking precedence over labels and external aria-labelledby. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Shared form-control size. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Show the supported clear action for a committed value. */
  @property({ type: Boolean }) clearable = false;
  /** Enable an editable filter; typing never commits a selection or a form value. */
  @property({ type: Boolean }) searchable = false;
  /** Place the popup in the browser top layer, including inside native dialogs. */
  @property({ type: Boolean, attribute: 'top-layer' }) topLayer = false;
  /** Explicit popup strategy; omission inherits --lr-positioning-strategy. */
  @property({ attribute: 'positioning-strategy' }) positioningStrategy?: PlaceStrategy;
  /** Native autocomplete guidance for the optional filter input. */
  @property() autocomplete = 'off';
  /** Native input keyboard hint for the optional filter. */
  @property({ attribute: 'inputmode' }) override inputMode = '';
  /** Native enter-key hint for the optional filter. */
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native spellchecking for the optional filter. */
  @property({ converter: pickerSpellcheckConverter, useDefault: true }) override spellcheck = false;
  /** Native capitalization guidance for the optional filter. */
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Native autocorrection guidance for the optional filter; HTML accepts on/off.
   * @default true */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean { return this.autocorrectValue; }
  override set autocorrect(next: boolean) { this.autocorrectValue = Boolean(next); this.requestUpdate(); }

  protected abstract get entries(): readonly SelectionCatalogEntry[];
  protected abstract get pickerLabel(): string;
  protected abstract resolveRows(): readonly SelectionCatalogRow[];
  protected normalizeValue(value: unknown): string { return normalizeSelectionValue(value); }
  protected renderAdornment(_row: SelectionCatalogRow): TemplateResult | typeof nothing { return nothing; }
  private renderStart(row: SelectionCatalogRow): TemplateResult | typeof nothing {
    const content = this.renderAdornment(row);
    return content === nothing ? nothing : html`<span slot="start">${content}</span>`;
  }

  /** Committed catalog identifier. Programmatic writes are silent. */
  override get value(): string { return super.value; }
  override set value(next: string) { super.value = this.normalizeValue(next); }
  /** Normalized reset default; null removes the value attribute without restoring stale content. */
  override get defaultValue(): string { return super.defaultValue; }
  override set defaultValue(next: string | null) { super.defaultValue = next === null ? null : this.normalizeValue(next); }
  /** Native filter input, or null in compact mode. Dispatch native input after direct value edits to refilter. */
  get input(): HTMLInputElement | null { return this.searchable ? this.combobox?.input ?? null : null; }

  private readonly slots = new SlotPresenceController(this);
  private labelLease?: ResolvedAriaRelationshipLease;
  private descriptionLease?: ResolvedAriaRelationshipLease;
  private validationChild?: PickerControl;
  private validationDocument?: Document;
  private projectedAnchor?: HTMLElement;
  private projectionToken = 0;
  private restoreFocus = false;
  private replacingControl?: PickerControl;
  private focusReplacement?: PickerControl;
  private readonly validationController: ReactiveController = { hostUpdated: () => this.projectValidation() };
  private cachedEntries?: readonly SelectionCatalogEntry[];
  private cachedLocale?: string;
  private cachedRows?: readonly SelectionCatalogRow[];

  protected get control(): PickerControl | undefined {
    return this.renderRoot?.querySelector<PickerControl>(`${tag('select')},${tag('combobox')}`) ?? undefined;
  }
  private get combobox(): LyraCombobox<false> | undefined {
    return this.renderRoot?.querySelector<LyraCombobox<false>>(tag('combobox')) ?? undefined;
  }
  private get liveDisabled(): boolean { return this.effectiveDisabled || this.matches(':disabled'); }
  private get rows(): readonly SelectionCatalogRow[] {
    if (this.cachedEntries !== this.entries || this.cachedLocale !== this.effectiveLocale || !this.cachedRows) {
      this.cachedEntries = this.entries;
      this.cachedLocale = this.effectiveLocale;
      this.cachedRows = this.resolveRows();
    }
    return this.cachedRows;
  }

  constructor() {
    super();
    this.addEventListener('invalid', () => this.projectValidation());
  }

  protected updateValidity(): void {
    if (!this.internals) return;
    if (isBarredFromValidation(this, this.internals)) this[SET_ANCHORED_VALIDITY]({});
    else if (this.value && !this.entries.some((row) => row.code === this.value && !row.disabled)) {
      this[SET_ANCHORED_VALIDITY]({ customError: true }, this.localize('notInCatalog'));
    } else if (this.required && !this.value) this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
    else this[SET_ANCHORED_VALIDITY]({});
  }
  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return resolveValidityAnchor(this.control) ?? null; }
  /** Focus the visible trigger or optional filter when enabled. */
  override focus(options?: FocusOptions): void { if (!this.liveDisabled) this.control?.focus(options); }
  /** Blur the visible control. */
  override blur(): void { this.control?.blur(); }
  /** Activate the visible trigger or optional filter when enabled. */
  override click(): void { if (!this.liveDisabled) this.control?.click(); }

  private readonly onControlEvent = (event: Event): void => {
    const child = this.control;
    if (!child || event.target !== child) return;
    event.stopPropagation();
    if (event.type !== 'lr-change') return;
    const raw = (event as CustomEvent<{ value: string | null }>).detail.value;
    const next = raw === null ? '' : raw;
    if (this.liveDisabled || typeof next !== 'string' || (next && !this.entries.some((row) => row.code === next && !row.disabled))) {
      this.syncChildValue(child);
      return;
    }
    if (next === this.value) return;
    const previousValue = this.value;
    this.value = next;
    const detail = { value: this.value, previousValue };
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', detail);
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', detail);
  };
  private readonly onControlFocus = (event: FocusEvent): void => {
    if (event.target !== this.control) return;
    event.stopPropagation();
    if (!this.replacingControl) relayNativeEvent(this, event);
  };
  private readonly onControlFocusOut = (event: FocusEvent): void => {
    if (event.target === this.replacingControl) event.stopPropagation();
  };
  private readonly onControlKeyDown = (event: KeyboardEvent): void => {
    if (!this.liveDisabled && this.searchable && event.target === this.control &&
        event.composedPath()[0] === this.input) submitOnEnter(this, event);
  };
  private syncChildValue(child: PickerControl): void {
    child.value = 'inputValue' in child ? this.value || null : this.value;
  }
  private clearTransientState(): void {
    const child = this.control;
    if (!child) return;
    child.open = false;
    child.formResetCallback();
    this.syncChildValue(child);
  }
  private projectValidation(): void {
    const child = this.validationChild;
    if (!child || !this.isConnected || child !== this.control || this.validationDocument !== this.ownerDocument) return;
    resolveValidityAnchor(child)?.setAttribute('aria-invalid', this.internals.states?.has('user-invalid') ? 'true' : 'false');
  }
  private syncRelationships(): void {
    const anchor = this[VALIDITY_ANCHOR]();
    if (this.descriptionLease) this.descriptionLease.update(anchor);
    else this.descriptionLease = acquireResolvedAriaRelationship(this, anchor, 'aria-describedby');
    if (this.accessibleLabel !== null) { this.labelLease?.release(); this.labelLease = undefined; }
    else if (this.labelLease) this.labelLease.update(anchor);
    else this.labelLease = acquireResolvedAriaRelationship(this, anchor, 'aria-labelledby');
    if (anchor && this.projectedAnchor !== anchor) { this.projectedAnchor = anchor; this.requestUpdate(); }
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const child = this.control;
    if (changed.has('searchable') && child) {
      this.replacingControl = child;
      this.restoreFocus = activeElementIn(this.shadowRoot) === child || this.focusReplacement === child;
      this.focusReplacement = undefined;
      this.clearTransientState();
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const child = this.control;
    if (this.restoreFocus) this.focusReplacement = child;
    this.restoreFocus = false;
    this.replacingControl = undefined;
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
      if (token !== this.projectionToken || !this.isConnected || this.ownerDocument !== document || child !== this.control) return;
      this.syncRelationships();
      if (this.focusReplacement === child) {
        this.focusReplacement = undefined;
        const active = deepActiveElementIn(document);
        if (!this.liveDisabled && (!active || active === document.body || active === this || active === child)) {
          child.focus({ preventScroll: true });
          void child.hide();
        }
      }
    });
  }
  override connectedCallback(): void { super.connectedCallback(); this.requestUpdate(); }
  override adoptedCallback(): void { super.adoptedCallback(); this.requestUpdate(); }
  override formResetCallback(): void { super.formResetCallback(); this.clearTransientState(); this.projectValidation(); }
  override formStateRestoreCallback(state: FormSubmissionValue, reason: 'autocomplete' | 'restore'): void {
    super.formStateRestoreCallback(state, reason);
    this.clearTransientState();
    this.projectValidation();
  }
  override disconnectedCallback(): void {
    ++this.projectionToken;
    this.clearTransientState();
    this.restoreFocus = false;
    this.focusReplacement = undefined;
    this.replacingControl = undefined;
    this.validationChild?.removeController(this.validationController);
    this.validationChild = undefined;
    this.validationDocument = undefined;
    this.projectedAnchor = undefined;
    this.cachedEntries = undefined;
    this.cachedRows = undefined;
    this.cachedLocale = undefined;
    this.labelLease?.release(); this.labelLease = undefined;
    this.descriptionLease?.release(); this.descriptionLease = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const controlTag = unsafeStatic(tag(this.searchable ? 'combobox' : 'select'));
    const optionTag = unsafeStatic(tag('option'));
    const hasLabel = Boolean(this.label) || this.slots.has('label');
    const current = this.rows.find((row) => row.code === this.value);
    const exportParts = [
      'form-control,form-control-label',
      this.searchable ? 'combobox:select-trigger,combobox-input:select-display-input' : 'trigger:select-trigger,display-input:select-display-input',
      'listbox:select-listbox,option:select-option,option-sub:select-option-sub,group-label:select-group-label,clear-button:select-clear-button,flag,hint,error',
    ].join(',');
    return html`<${controlTag}
      exportparts=${exportParts}
      style=${styleMap({ '--lr-positioning-strategy': this.positioningStrategy === 'fixed' || this.positioningStrategy === 'absolute' ? this.positioningStrategy : undefined })}
      .strings=${this.strings} .customError=${this.validity.valid ? null : this.validationMessage}
      .value=${this.searchable ? this.value || null : this.value}
      .label=${this.label} .hint=${this.hint} .errorText=${this.errorText}
      .placeholder=${this.placeholder ?? this.localize('select')}
      aria-label=${this.accessibleLabel ?? (hasLabel ? nothing : this.pickerLabel)}
      .required=${this.required} .disabled=${this.effectiveDisabled} .size=${this.size}
      .clearable=${this.clearable} .topLayer=${this.topLayer}
      .maxRender=${this.searchable ? this.rows.length || 1 : noChange}
      .autocomplete=${this.searchable ? this.autocomplete : noChange}
      .inputMode=${this.searchable ? this.inputMode : noChange} .enterKeyHint=${this.searchable ? this.enterKeyHint : noChange}
      .spellcheck=${this.searchable ? this.spellcheck : noChange}
      .autocapitalize=${this.searchable ? this.autocapitalize : noChange} .autocorrect=${this.searchable ? this.autocorrect : noChange}
      autocorrect=${this.searchable && this.hasAttribute('autocorrect') ? (this.autocorrect ? 'on' : 'off') : nothing}
      @input=${this.onControlEvent} @lr-input=${this.onControlEvent} @lr-filter=${this.onControlEvent}
      @change=${this.onControlEvent} @lr-change=${this.onControlEvent}
      @focus=${this.onControlFocus} @blur=${this.onControlFocus} @focusout=${this.onControlFocusOut}
      @keydown=${this.onControlKeyDown}
    >${this.rows.map((row) => html`<${optionTag} .value=${row.code} .label=${row.label}
      .sub=${[row.code, row.symbol].filter((text) => Boolean(text) && text !== row.label).join(' · ')}
      .searchText=${row.searchText} .group=${row.group ?? ''} .disabled=${Boolean(row.disabled)}>
      ${this.renderStart(row)}${row.label}</${optionTag}>`)}
      ${current ? this.renderStart(current) : nothing}
      ${this.slots.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing}
      ${this.slots.has('hint') ? html`<slot name="hint" slot="hint"></slot>` : nothing}
      ${this.slots.has('error') ? html`<slot name="error" slot="error"></slot>` : nothing}
    </${controlTag}>`;
  }
}
