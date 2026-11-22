import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { writeCatalogProperty, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { COUNTRY_CODES, resolveCountryNames, snapshotCountryCatalog, type LyraCountryCatalog, type LyraCountryEntry } from '../../../countries.js';
import { styles } from './country-picker.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_catalogPickerSearchLoadFailed, LYRA_DEFAULT_countryPickerLabel } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_catalogPickerInputLimit, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_retry, LYRA_DEFAULT_select } from '../../../internal/default-strings/shared.generated.js';
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
 * @cssprop [--lr-form-control-label-font-size=var(--lr-font-size-md-sm)] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=inherit] - Text color of the field label.
 * @cssprop [--lr-form-control-label-inline-size=30%] - Label column width while
 *   `label-placement="start"`.
 * @cssprop [--lr-form-control-label-gap=var(--lr-space-m)] - Space between the label column and
 *   the field while `label-placement="start"`.
 * @cssprop [--lr-form-control-label-block-gap=var(--lr-space-xs)] - Space between a label above
 *   the field and the field, in top placement and once a `label-placement="start"` row collapses.
 * @cssprop [--lr-form-control-label-collapse-inline-size=var(--lr-size-20rem)] - Control width
 *   below which `label-placement="start"` returns the label above the field.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The visible trigger or filter frame.
 * @csspart select-display-input - The committed name or optional filter input.
 * @csspart select-listbox - The offered countries.
 * @csspart select-option-overflow - Count of rows outside the 1,000-option popup ceiling; searchable mode can filter to them.
 * @csspart select-option - A country option.
 * @csspart select-option-sub - The country identifier.
 * @csspart select-group-label - A caller-provided group heading.
 * @csspart select-clear-button - The optional clear action.
 * @csspart flag - Decorative country flag emoji.
 * @csspart limit - Catalog input-loss notice, separate from the popup render-window overflow.
 * @csspart search-error - Localized notice when the optional filter cannot be loaded.
 * @csspart search-retry - Button that retries loading the filter.
 * @cssprop [--lr-form-control-invalid-border-color=var(--lr-color-danger)] - Invalid resting border color.
 * @event lr-load-error - The optional filter could not be loaded. The compact picker remains available.
 * @csspart hint - Field guidance.
 * @csspart error - Validation guidance.
 * @event lr-show - Cancelable request to open the country list.
 * @event lr-hide - Request to close the country list; a connected, enabled transition can be vetoed.
 * @event lr-after-show - The country list finished opening.
 * @event lr-after-hide - The country list finished closing.
 * @event lr-activate - An offered country was activated, with its code in `detail.value`.
 * @event lr-clear - The clear button emptied the selected country.
 * @event {Event} input - User selection changed the committed value and form state.
 * @event lr-input - User selection changed the committed value.
 * @event {Event} change - Fired once after a user selection or clear.
 * @event lr-change - User selection changed the committed value.
 * @event lr-change-request - A user selection or clear is about to change the value;
 *   `detail: { value, previousValue }` carries the proposed code while `value` still holds the
 *   current one. Cancelable: `preventDefault()` keeps the current value and none of
 *   `input`/`lr-input`/`change`/`lr-change`/`lr-clear` follow. A listener may resolve it by
 *   assigning `value` itself, which supersedes the proposal (a same-value write included).
 *   Programmatic writes, reset/restoration and re-picking the current option emit no request.
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
    catalogPickerInputLimit: LYRA_DEFAULT_catalogPickerInputLimit,
    catalogPickerSearchLoadFailed: LYRA_DEFAULT_catalogPickerSearchLoadFailed,
    countryPickerLabel: LYRA_DEFAULT_countryPickerLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    retry: LYRA_DEFAULT_retry,
    select: LYRA_DEFAULT_select,
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
    writeCatalogProperty(this, 'countries', this._countries,
      () => snapshotCountryCatalog(value),
      catalog => { this._countries = catalog; },
      () => this.updateValidity());
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
