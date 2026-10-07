import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { styles } from './currency-picker.styles.js';
import { DEFAULT_CURRENCY_ENTRIES, normalizeCurrencyValue } from './currency-catalog.js';
import { resolveCurrencyPresentation } from './currency-presentation.js';
import type { LyraCurrencyCatalog, LyraCurrencyEntry } from './currency-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_currencyPickerLabel, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraCurrencyCatalog, LyraCurrencyEntry } from './currency-types.js';
export type LyraCurrencyChangeDetail = LyraCatalogPickerChangeDetail;
export interface LyraCurrencyPickerEventMap extends LyraCatalogPickerEventMap {}

/**
 * `<lr-currency-picker>` — a form-associated currency-code selector.
 *
 * The trigger shows the committed ISO code; options pair code-only type-ahead with localized
 * names and symbols. Omission uses a pinned catalog of 176 currency, fund and metal codes.
 * Supply `currencies` for an ordered application subset, literal display overrides or contiguous
 * groups. Opt into `searchable` for code, localized name and regular/narrow symbol filtering.
 * Filter text is transient: typing never commits a currency or emits selection events.
 * As in the composed combobox, text equal to the selected code keeps the full list available.
 *
 * Empty values remain uncommitted. Unknown, malformed and subsequently disabled values remain
 * visible and invalid until replaced or cleared. Programmatic changes, catalog updates, locale
 * changes and form reset are silent. A user commit emits input, lr-input, change and lr-change
 * exactly once, after the value and outer form state have changed.
 *
 * The outer field owns form submission, defaults and validation. The composed select or combobox supplies
 * supported keyboard, popup and field chrome behavior. Selection does not convert amounts,
 * persist a preference, fetch exchange rates or change the page locale.
 *
 * @customElement lr-currency-picker
 * @slot label - Custom field label.
 * @slot hint - Custom field guidance.
 * @slot error - Custom validation guidance.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The select trigger or searchable input container.
 * @csspart select-display-input - The selected code or editable filter input.
 * @csspart select-listbox - The currency listbox.
 * @csspart select-option - A currency option.
 * @csspart select-option-sub - The option descriptive subtext.
 * @csspart select-group-label - A caller-supplied contiguous group heading.
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
 * @since 25.5.0
 */
export class LyraCurrencyPicker extends LyraCatalogPickerBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    currencyPickerLabel: LYRA_DEFAULT_currencyPickerLabel,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _currencies?: readonly LyraCurrencyEntry[];
  /** Clone-owned, bounded catalog snapshot. Undefined/null restores defaults; [] stays empty. */
  @property({ attribute: false })
  get currencies(): LyraCurrencyCatalog | undefined { return this._currencies; }
  set currencies(next: LyraCurrencyCatalog | undefined) {
    const previous = this._currencies;
    this._currencies = snapshotSelectionCatalog(next, normalizeCurrencyValue, (code) => /^[A-Z]{3}$/.test(code));
    this.updateValidity();
    this.requestUpdate('currencies', previous);
  }
  protected override get entries(): readonly LyraCurrencyEntry[] { return this._currencies ?? DEFAULT_CURRENCY_ENTRIES; }
  protected override get pickerLabel(): string { return this.localize('currencyPickerLabel'); }
  protected override normalizeValue(value: unknown): string { return normalizeCurrencyValue(value); }
  protected override resolveRows(): readonly SelectionCatalogRow[] { return resolveCurrencyPresentation(this.entries, this.effectiveLocale); }
  protected override optionDisplay(row: SelectionCatalogRow): { label: string; sub: string } {
    return { label: row.code, sub: [row.label, row.symbol].filter((text) => Boolean(text)).join(' · ') };
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-currency-picker': LyraCurrencyPicker; } }
