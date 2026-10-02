import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { COUNTRY_CODES, resolveCountryNames, type LyraCountryCatalog, type LyraCountryEntry } from '../../../countries.js';
import { styles } from './country-picker.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

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
 * @since unreleased
 */
export class LyraCountryPicker extends LyraCatalogPickerBase {
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
