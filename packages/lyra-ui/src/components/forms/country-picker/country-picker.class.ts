import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { COUNTRY_CODES, resolveCountryNames, type LyraCountryCatalog, type LyraCountryEntry } from '../../../countries.js';
import { styles } from './country-picker.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_countryPickerLabel, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraCountryCatalog, LyraCountryEntry } from '../../../countries.js';
export type LyraCountryChangeDetail = LyraCatalogPickerChangeDetail;
export interface LyraCountryPickerEventMap extends LyraCatalogPickerEventMap {}
const defaultEntries = Object.freeze(COUNTRY_CODES.map((code) => Object.freeze({ code })));
function normalizeCountry(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z]{2}$/.test(text) ? text.toUpperCase() : text;
}

/**
 * `<lr-country-picker>` — a form-associated country and territory selector.
 * Defaults to the pinned 249-code ISO catalog, localized names and decorative emoji flags.
 * Platform fonts may display flag letters; the visible name always identifies the country.
 * Opt-in searchable filters names and codes without changing the committed form value.
 * Catalogs preserve caller order and contiguous groups. Unknown or disabled values remain
 * visible and invalid. Programmatic changes, locale changes and reset emit no selection events.
 *
 * @customElement lr-country-picker
 * @slot label - Custom field label.
 * @slot hint - Custom field guidance.
 * @slot error - Custom validation guidance.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The visible trigger or filter frame.
 * @csspart select-display-input - The committed name or optional filter input.
 * @csspart select-listbox - The offered countries.
 * @csspart select-option - A country option.
 * @csspart select-option-sub - The country identifier.
 * @csspart select-group-label - A caller-provided group heading.
 * @csspart select-clear-button - The optional clear action.
 * @csspart flag - Decorative country flag emoji.
 * @csspart hint - Field guidance.
 * @csspart error - Validation guidance.
 * @event {Event} input - User selection changed the committed value and form state.
 * @event lr-input - User selection changed the committed value.
 * @event {Event} change - Fired once after a user selection or clear.
 * @event lr-change - User selection changed the committed value.
 * @event lr-invalid - Native invalid alias. Cancelable: preventDefault suppresses validation UI.
 * @event {FocusEvent} focus - Re-dispatched from the visible control, bubbling and composed.
 * @event {FocusEvent} blur - Re-dispatched from the visible control, bubbling and composed.
 * @status experimental
 * @since 25.5.0
 */
export class LyraCountryPicker extends LyraCatalogPickerBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    countryPickerLabel: LYRA_DEFAULT_countryPickerLabel,
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
  /** Show decorative country flag emoji beside names; false hides them. */
  @property({ converter: trueDefaultBooleanConverter }) flags = true;
  private _countries?: readonly LyraCountryEntry[];
  /** Clone-owned ordered catalog. Undefined/null restores ISO defaults; [] stays empty. */
  @property({ attribute: false })
  get countries(): LyraCountryCatalog | undefined { return this._countries; }
  set countries(value: LyraCountryCatalog | null | undefined) {
    const previous = this._countries;
    this._countries = snapshotSelectionCatalog(value, normalizeCountry, (code) => /^[A-Z]{2}$/.test(code));
    this.updateValidity();
    this.requestUpdate('countries', previous);
  }
  protected override get entries(): readonly LyraCountryEntry[] { return this._countries ?? defaultEntries; }
  protected override get pickerLabel(): string { return this.localize('countryPickerLabel'); }
  protected override normalizeValue(value: unknown): string { return normalizeCountry(value); }
  protected override resolveRows(): readonly SelectionCatalogRow[] { return resolveCountryNames(this.entries, this.effectiveLocale); }
  protected override renderAdornment(row: SelectionCatalogRow): TemplateResult | typeof nothing {
    if (!this.flags || !/^[A-Z]{2}$/.test(row.code)) return nothing;
    const emoji = String.fromCodePoint(...[...row.code].map((char) => char.charCodeAt(0) + 127397));
    return html`<span part="flag" aria-hidden="true">${emoji}</span>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-country-picker': LyraCountryPicker; } }
