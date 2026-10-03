import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeSelectionValue, snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { UNIT_CODES, resolveUnitNames, type LyraUnitCatalog, type LyraUnitEntry } from '../../../units.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { styles } from './unit-picker.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed, LYRA_DEFAULT_unitPickerLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraUnitCatalog, LyraUnitEntry } from '../../../units.js';
export type LyraUnitChangeDetail = LyraCatalogPickerChangeDetail;
export interface LyraUnitPickerEventMap extends LyraCatalogPickerEventMap {}
const defaultEntries = Object.freeze(UNIT_CODES.map((code) => Object.freeze({ code })));

/**
 * `<lr-unit-picker>` — a form-associated measurement-unit identifier selector.
 * Defaults to the standard ECMA-402 simple measurement units with localized names and symbols.
 * Caller catalogs may include custom or compound identifiers with explicit display text.
 * Opt-in searchable filters identifiers, names and symbols without changing the committed value.
 * Catalogs preserve caller order and contiguous groups. Identifiers are trimmed and retain case.
 * Unavailable or disabled values remain visible and invalid. Programmatic changes, locale
 * changes and reset emit no selection events. Selection does not convert or edit measurements.
 *
 * @customElement lr-unit-picker
 * @slot label - Custom field label.
 * @slot hint - Custom field guidance.
 * @slot error - Custom validation guidance.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The visible trigger or filter frame.
 * @csspart select-display-input - The committed name or optional filter input.
 * @csspart select-listbox - The offered measurement units.
 * @csspart select-option - A measurement-unit option.
 * @csspart select-option-sub - The unit identifier and symbol.
 * @csspart select-group-label - A caller-provided group heading.
 * @csspart select-clear-button - The optional clear action.
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
export class LyraUnitPicker extends LyraCatalogPickerBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
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
    unitPickerLabel: LYRA_DEFAULT_unitPickerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _units?: readonly LyraUnitEntry[];

  /** Clone-owned ordered catalog, capped at 1024 rows. Undefined/null restores standard defaults; [] stays empty. */
  @property({ attribute: false })
  get units(): LyraUnitCatalog | undefined { return this._units; }
  set units(value: LyraUnitCatalog | null | undefined) {
    const previous = this._units;
    this._units = snapshotSelectionCatalog(value, normalizeSelectionValue);
    this.updateValidity();
    this.requestUpdate('units', previous);
  }

  protected override get entries(): readonly LyraUnitEntry[] { return this._units ?? defaultEntries; }
  protected override get pickerLabel(): string { return this.localize('unitPickerLabel'); }
  protected override resolveRows(): readonly SelectionCatalogRow[] { return resolveUnitNames(this.entries, this.effectiveLocale); }
}

declare global { interface HTMLElementTagNameMap { 'lr-unit-picker': LyraUnitPicker; } }
