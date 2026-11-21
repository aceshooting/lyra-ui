import { MAX_RENDERED_OPTION_ROWS } from '../../internal/option-selection.js';
import { guard } from 'lit/directives/guard.js';
import { noChange, nothing, type PropertyValues, type ReactiveController, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation, type FormSubmissionValue, isLiveDisabled } from '../../internal/form-associated.js';
import { resolveValidityAnchor, SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../internal/anchored-validity.js';
import { acquireResolvedAriaRelationship, type ResolvedAriaRelationshipLease } from '../../internal/aria-controls.js';
import { AnnouncementSinkController } from '../../internal/announcer.js';
import { collectionSupport } from '../../internal/collection-snapshot.js';
import { autocorrectConverter, spellcheckConverter } from '../../internal/converters.js';
import { relayNativeEvent } from '../../internal/native-event-relay.js';
import { emitValueEvents } from '../../internal/value-events.js';
import { requestThenCommit } from '../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../internal/veto-write-guard.js';
import { deepActiveElementIn, shadowFocusTarget } from '../../internal/active-element.js';
import { submitOnEnter } from '../../internal/submit-on-enter.js';
import { SlotPresenceController } from '../../internal/slot-presence-controller.js';
import { tag } from '../../internal/prefix.js';
import { resolveEffectivePositioningStrategy } from '../../internal/positioning-strategy.js';
import { hasCustomState } from '../../internal/custom-states.js';
import { getListFormat } from '../../internal/intl-cache.js';
import { normalizeSelectionValue, selectionCatalogTruncation, type SelectionCatalogEntry, type SelectionCatalogRow } from '../../internal/selection-catalog.js';
import type { PlaceStrategy } from '../../internal/positioner.js';
import type { LyraLabelDisplay, LyraSize, LyraLabelPlacement } from '../../internal/variants.js';
import type { LyraSelect, LyraSelectEventMap } from './select/select.class.js';
import type { LyraCombobox } from './combobox/combobox.class.js';
import { styles } from './catalog-picker-base.styles.js';

export interface LyraCatalogPickerChangeDetail {
  readonly value: string;
  readonly previousValue: string;
}

export interface LyraCatalogPickerEventMap extends Pick<
  LyraSelectEventMap<false>,
  'lr-show' | 'lr-after-show' | 'lr-hide' | 'lr-after-hide' | 'lr-activate' | 'lr-clear'
> {
  'lr-input': CustomEvent<LyraCatalogPickerChangeDetail>;
  'lr-change': CustomEvent<LyraCatalogPickerChangeDetail>;
  /** Cancelable proposal before a user selection or clear commits. */
  'lr-change-request': CustomEvent<LyraCatalogPickerChangeDetail>;
  'lr-invalid': CustomEvent<null>;
  'lr-load-error': CustomEvent<null>;
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
  protected static override readonly immutableEventDetails = Object.freeze(['lr-input', 'lr-change', 'lr-change-request']);
  /** Visible field label; the label slot takes precedence. */
  @property() label = '';
  /** Whether the `label` renders on screen; `hidden` keeps it as the accessible name. */
  @property({ attribute: 'label-display', reflect: true }) labelDisplay: LyraLabelDisplay = 'visible';
  /**
   * Where the label sits: `top` (default) above the field, or `start` in an inline-start column
   * of `--lr-form-control-label-inline-size`, with hint and error aligned under the field. Below
   * `--lr-form-control-label-collapse-inline-size` the label returns above the field. The label
   * association is unchanged. Reflected so `[label-placement]` selectors match.
   * @attr label-placement
   */
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: LyraLabelPlacement = 'top';
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
  /** Enable an editable filter. If loading fails, the compact control stays usable and offers a retry. */
  @property({ type: Boolean }) searchable = false;
  /**
   * Shows the open listbox in the browser top layer wherever the native Popover API exists, so it
   * paints above every page layer whatever the stacking contexts around it, including inside a
   * native modal dialog. Use it inside a fixed or sticky header, toolbar or rail with its own
   * `z-index` that a sibling surface stacked higher would otherwise cover. While set, the listbox
   * is placed with the `fixed` strategy whatever `positioning-strategy` resolves to; no DOM node
   * moves, so anchoring, RTL placement, focus and Escape are unchanged. It leaves the top layer
   * once the listbox settles closed. Stacking contexts are deliberately not detected
   * automatically. Without native Popover API support the listbox keeps its ordinary
   * `var(--lr-overlay-stack-index, var(--lr-layer-dropdown))` stacking. Same contract as
   * `<lr-select>`'s `top-layer`. Changes apply live while open.
   * @default false
   */
  @property({ type: Boolean, attribute: 'top-layer', reflect: true }) topLayer = false;
  /** Explicit popup strategy; omission inherits --lr-positioning-strategy. */
  @property({ attribute: 'positioning-strategy' }) positioningStrategy?: PlaceStrategy;
  /** Native autocomplete guidance for the optional filter input. */
  @property({ useDefault: true }) autocomplete = 'off';
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
  /** The option's visible label and secondary line. */
  protected optionDisplay(row: SelectionCatalogRow): { label: string; sub: string } {
    const parts = [row.code, row.symbol].filter((text): text is string => Boolean(text) && text !== row.label);
    return { label: row.label, sub: getListFormat(this.effectiveLocale, { type: 'unit', style: 'short' }).format(parts) };
  }
  private renderStart(row: SelectionCatalogRow): TemplateResult | typeof nothing {
    const content = this.renderAdornment(row);
    return content === nothing ? nothing : html`<span slot="start">${content}</span>`;
  }

  /** Committed catalog identifier. Programmatic writes are silent. */
  override get value(): string { return super.value; }
  override set value(next: string) {
    super.value = this.normalizeValue(next);
    markVetoGuardWrite(this.changeGuard);
  }
  /** Normalized reset default; null removes the value attribute without restoring stale content. */
  override get defaultValue(): string { return super.defaultValue; }
  override set defaultValue(next: string | null) { super.defaultValue = next === null ? null : this.normalizeValue(next); }
  /** Native filter input, or null in compact mode. Dispatch native input after direct value edits to refilter. */
  get input(): HTMLInputElement | null { return this.searchable ? this.combobox?.input ?? null : null; }

  private readonly resolvedRows = new WeakMap<readonly SelectionCatalogEntry[], Map<string, readonly SelectionCatalogRow[]>>();
  private optionsMounted = false;
  private readonly announcements = new AnnouncementSinkController(this);
  private get inputLimitMessage(): string {
    return selectionCatalogTruncation(this.entries) ? this.localize('catalogPickerInputLimit') : '';
  }
  private rowPresentationEpoch = 0;
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    const name = args[0];
    if (name === undefined && this.hasUpdated) this.resolvedRows.delete(this.entries);
    if (name === undefined || !['value', 'defaultValue', 'label', 'hint', 'errorText', 'placeholder',
      'accessibleLabel', 'required', 'disabled', 'size', 'clearable', 'topLayer', 'name'].includes(String(name))) {
      this.rowPresentationEpoch = (this.rowPresentationEpoch ?? 0) + 1;
    }
    super.requestUpdate(...args);
  }
  private readonly mountOptions = (): void => {
    if (this.optionsMounted) return;
    this.optionsMounted = true;
    this.requestUpdate('optionsMounted', false);
  };
  private readonly onControlShow = (event: Event): void => {
    if (event.target === this.control) this.mountOptions();
  };
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

  protected get control(): PickerControl | undefined {
    return this.renderRoot?.querySelector<PickerControl>(`${tag('select')},${tag('combobox')}`) ?? undefined;
  }
  private get combobox(): LyraCombobox<false> | undefined {
    return this.renderRoot?.querySelector<LyraCombobox<false>>(tag('combobox')) ?? undefined;
  }
  private get rows(): readonly SelectionCatalogRow[] {
    const entries = this.entries;
    const locale = this.effectiveLocale;
    let byLocale = this.resolvedRows.get(entries);
    if (!byLocale) this.resolvedRows.set(entries, (byLocale = new Map()));
    let rows = byLocale.get(locale);
    if (!rows) byLocale.set(locale, (rows = this.resolveRows()));
    return rows;
  }

  constructor() {
    super();
    this.addEventListener('invalid', () => this.projectValidation());
  }

  protected updateValidity(): void {
    if (!this.internals) return;
    if (isBarredFromValidation(this, this.internals)) this[SET_ANCHORED_VALIDITY]({});
    else if (this.value && !this.entries.some((row) => row.code === this.value && !row.disabled)) {
      this[SET_ANCHORED_VALIDITY]({ customError: true }, () => this.localize('notInCatalog'));
    } else if (this.required && !this.value) this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, () => this.localize('fieldRequired'));
    else this[SET_ANCHORED_VALIDITY]({});
  }
  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null { return resolveValidityAnchor(this.control) ?? null; }
  /** Focus the visible trigger or optional filter when enabled. */
  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) return;
    if (!isLiveDisabled(this)) this.control?.focus(options);
  }
  /** Blur the visible control. */
  override blur(): void { this.control?.blur(); }
  /** Activate the visible trigger or optional filter when enabled. */
  override click(): void { if (!isLiveDisabled(this)) this.control?.click(); }

  // A listener that answers `lr-change-request` by writing `value` finishes before the visible
  // control commits; the guard records that it wrote at all.
  private readonly changeGuard = new VetoWriteGuard();
  /** Re-issues the visible control's selection proposal as this picker's own request. */
  private readonly onControlRequest = (event: Event): void => {
    const child = this.control;
    if (!child || event.target !== child) return;
    event.stopPropagation();
    const raw = (event as CustomEvent<{ value: unknown }>).detail.value;
    const next = raw === null ? '' : raw;
    // An unavailable proposal is not offered to listeners: the control's own `lr-change` reaches
    // `onControlEvent()`, which rejects it and restores the control's display.
    if (isLiveDisabled(this) || typeof next !== 'string' || (next && !this.entries.some((row) => row.code === next && !row.disabled))) return;
    if (next === this.value) return;
    let accepted = false;
    requestThenCommit({
      requestDetail: { value: next, previousValue: this.value },
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-change-request', detail, init),
      guard: this.changeGuard,
      // The visible control applies the write; its `lr-change` then commits it here.
      commit: () => { accepted = true; },
    });
    if (accepted) return;
    event.preventDefault();
    this.requestUpdate();
  };
  private readonly onControlEvent = (event: Event): void => {
    const child = this.control;
    if (!child || event.target !== child) return;
    event.stopPropagation();
    if (event.type !== 'lr-change') return;
    const raw = (event as CustomEvent<{ value: string | null }>).detail.value;
    const next = raw === null ? '' : raw;
    if (isLiveDisabled(this) || typeof next !== 'string' || (next && !this.entries.some((row) => row.code === next && !row.disabled))) {
      this.syncChildValue(child);
      return;
    }
    if (next === this.value) return;
    const previousValue = this.value;
    this.value = next;
    const detail = { value: this.value, previousValue };
    emitValueEvents(this, 'input', detail, captured => this.emit('lr-input', captured));
    emitValueEvents(this, 'change', detail, captured => this.emit('lr-change', captured));
  };
  private readonly onControlFocus = (event: FocusEvent): void => {
    if (event.target !== this.control) return;
    if (event.type === 'focus') this.mountOptions();
    event.stopPropagation();
    if (!this.replacingControl) relayNativeEvent(this, event);
  };
  private readonly onControlFocusOut = (event: FocusEvent): void => {
    if (event.target === this.replacingControl) event.stopPropagation();
  };
  private readonly onControlKeyDown = (event: KeyboardEvent): void => {
    if (!isLiveDisabled(this) && this.searchable && event.target === this.control &&
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
    const invalid = this.errorText || this.slots.has('error') || hasCustomState(this.internals, 'user-invalid');
    resolveValidityAnchor(child)?.setAttribute('aria-invalid', invalid ? 'true' : 'false');
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
  /** The filter control loads on first use, so a plain picker never ships the combobox. */
  private get comboboxDefined(): boolean { return globalThis.customElements?.get(tag('combobox')) !== undefined; }
  private comboboxLoad?: Promise<void>;
  private comboboxFailed = false;
  private usingCombobox = false;
  private loadCombobox = (): Promise<unknown> => import('./combobox/combobox-catalog.js');

  private readonly retrySearch = (): void => {
    if (isLiveDisabled(this)) return;
    this.focus();
    this.comboboxFailed = false;
    this.requestUpdate();
  };
  /** `updateComplete` also waits for the lazily loaded filter control to take over. */
  protected override async getUpdateComplete(): Promise<boolean> {
    await super.getUpdateComplete();
    const load = this.comboboxLoad;
    if (!load) return super.getUpdateComplete();
    await load;
    return this.getUpdateComplete();
  }
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.searchable) this.comboboxFailed = false;
    if (this.isConnected && this.searchable && !this.comboboxDefined && !this.comboboxLoad && !this.comboboxFailed) {
      this.comboboxLoad = this.loadCombobox().then(
        () => { this.comboboxLoad = undefined; this.requestUpdate(); },
        () => {
          this.comboboxLoad = undefined;
          if (!this.isConnected || !this.searchable) return;
          this.comboboxFailed = !this.comboboxDefined;
          this.requestUpdate();
          if (!this.comboboxFailed) return;
          this.announcements.announcePolite(this.localize('catalogPickerSearchLoadFailed'));
          this.emit('lr-load-error');
        },
      );
    }
    const child = this.control;
    const combobox = this.searchable && this.comboboxDefined;
    if (combobox !== this.usingCombobox && child) {
      this.replacingControl = child;
      this.restoreFocus = shadowFocusTarget(this) === child || this.focusReplacement === child;
      this.focusReplacement = undefined;
      this.clearTransientState();
    }
    this.usingCombobox = combobox;
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const loss = selectionCatalogTruncation(this.entries);
    this.announcements.transition('input-limit', loss ? `${loss.source}:${loss.retained}:${loss.omitted}` : '', this.inputLimitMessage, 'polite');
    const child = this.control;
    if (this.restoreFocus) this.focusReplacement = child;
    this.restoreFocus = false;
    this.replacingControl = undefined;
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
        if (!isLiveDisabled(this) && (!active || active === document.body || active === this || active === child)) {
          child.focus({ preventScroll: true });
          void child.hide();
        }
      }
    });
  }
  override connectedCallback(): void { super.connectedCallback(); this.requestUpdate(); }
  override adoptedCallback(): void { super.adoptedCallback(); this.announcements.adopted(); this.requestUpdate(); }
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
    this.labelLease?.release(); this.labelLease = undefined;
    this.descriptionLease?.release(); this.descriptionLease = undefined;
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const controlTag = unsafeStatic(tag(this.usingCombobox ? 'combobox' : 'select'));
    const optionTag = unsafeStatic(tag('option'));
    const hasLabel = Boolean(this.label) || this.slots.has('label');
    const current = this.rows.find((row) => row.code === this.value);
    const optionRows = this.optionsMounted ? this.rows : current ? [current] : [];
    const exportParts = [
      'form-control,form-control-label',
      this.usingCombobox ? 'combobox:select-trigger,combobox-input:select-display-input' : 'trigger:select-trigger,display-input:select-display-input',
      'listbox:select-listbox,option:select-option,option-overflow:select-option-overflow,option-sub:select-option-sub,group-label:select-group-label,clear-button:select-clear-button,flag,hint,error',
    ].join(',');
    return html`<${controlTag}
      exportparts=${exportParts}
      .positioningStrategy=${this.ownerDocument ? resolveEffectivePositioningStrategy(this, this.positioningStrategy, 'absolute') : this.positioningStrategy}
      .strings=${this.strings} .customError=${this.validity.valid ? null : this.validationMessage}
      .value=${this.usingCombobox ? this.value || null : this.value}
      .label=${this.label} .labelDisplay=${this.labelDisplay} .labelPlacement=${this.labelPlacement} .hint=${this.hint} .errorText=${this.errorText}
      .placeholder=${this.placeholder ?? this.localize('select')}
      aria-label=${this.accessibleLabel ?? (hasLabel ? nothing : this.pickerLabel)}
      .required=${this.required} .disabled=${this.effectiveDisabled} .size=${this.size}
      .clearable=${this.clearable} .topLayer=${this.topLayer}
      .maxRender=${Math.min(this.rows.length || 1, MAX_RENDERED_OPTION_ROWS)}
      .autocomplete=${this.usingCombobox ? this.autocomplete : noChange}
      .inputMode=${this.usingCombobox ? this.inputMode : noChange} .enterKeyHint=${this.usingCombobox ? this.enterKeyHint : noChange}
      .spellcheck=${this.usingCombobox ? this.spellcheck : noChange}
      .autocapitalize=${this.usingCombobox ? this.autocapitalize : noChange} .autocorrect=${this.usingCombobox ? this.autocorrect : noChange}
      autocorrect=${this.usingCombobox && this.hasAttribute('autocorrect') ? (this.autocorrect ? 'on' : 'off') : nothing}
      @input=${this.onControlEvent} @lr-input=${this.onControlEvent} @lr-filter=${this.onControlEvent}
      @change=${this.onControlEvent} @lr-change=${this.onControlEvent} @lr-change-request=${this.onControlRequest}
      @focus=${this.onControlFocus} @blur=${this.onControlFocus} @focusout=${this.onControlFocusOut}
      @keydown=${this.onControlKeyDown} @lr-show=${this.onControlShow}
    >${guard([optionRows, this.rowPresentationEpoch], () => optionRows.map((row) => {
      const { label, sub } = this.optionDisplay(row);
      return html`<${optionTag} .value=${row.code} .label=${label} .sub=${sub}
        .searchText=${row.searchText} .group=${row.group ?? ''} .disabled=${Boolean(row.disabled)}>
        ${this.renderStart(row)}${label}</${optionTag}>`;
    }))}
      ${current ? this.renderStart(current) : nothing}
      ${current?.disabled ? html`<span slot="end">${this.localize('notInCatalog')}</span>` : nothing}
      ${this.slots.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing}
      ${this.slots.has('hint') ? html`<slot name="hint" slot="hint"></slot>` : nothing}
      <slot name="error" slot="error"></slot>
    </${controlTag}>
    ${this.searchable && this.comboboxFailed && !this.usingCombobox
      ? html`<div class="search-failure">
          <p part="search-error">${this.localize('catalogPickerSearchLoadFailed')}</p>
          <button part="search-retry" type="button" ?disabled=${this.effectiveDisabled} @click=${this.retrySearch}>
            ${this.localize('retry')}
          </button>
        </div>`
      : nothing}
    ${this.inputLimitMessage ? html`<p part="limit">${this.inputLimitMessage}</p>` : nothing}`;
  }
}
