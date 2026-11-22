import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { writeCatalogProperty, normalizeSelectionValue, snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { UNIT_CODES, resolveUnitNames, type LyraUnitCatalog, type LyraUnitEntry } from '../../../units.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { styles } from './unit-picker.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_catalogPickerSearchLoadFailed, LYRA_DEFAULT_unitPickerLabel } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_catalogPickerInputLimit, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_retry, LYRA_DEFAULT_select } from '../../../internal/default-strings/shared.generated.js';
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
 * @csspart select-listbox - The offered measurement units.
 * @csspart select-option-overflow - Count of rows outside the 1,000-option popup ceiling; searchable mode can filter to them.
 * @csspart select-option - A measurement-unit option.
 * @csspart select-option-sub - The unit identifier and symbol.
 * @csspart select-group-label - A caller-provided group heading.
 * @csspart select-clear-button - The optional clear action.
 * @csspart limit - Catalog input-loss notice, separate from the popup render-window overflow.
 * @csspart search-error - Localized notice when the optional filter cannot be loaded.
 * @csspart search-retry - Button that retries loading the filter.
 * @cssprop [--lr-form-control-invalid-border-color=var(--lr-color-danger)] - Invalid resting border color.
 * @event lr-load-error - The optional filter could not be loaded. The compact picker remains available.
 * @event lr-show - Cancelable request to open the options.
 * @event lr-hide - Request to close the options; an ordinary transition can be vetoed.
 * @event lr-after-show - The options finished opening.
 * @event lr-after-hide - The options finished closing.
 * @event lr-activate - An enabled option was activated, including a repeated selection.
 * @event lr-clear - The clear action emptied the selection.
 * @csspart hint - Field guidance.
 * @csspart error - Validation guidance.
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
export class LyraUnitPicker extends LyraCatalogPickerBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    catalogPickerInputLimit: LYRA_DEFAULT_catalogPickerInputLimit,
    catalogPickerSearchLoadFailed: LYRA_DEFAULT_catalogPickerSearchLoadFailed,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    retry: LYRA_DEFAULT_retry,
    select: LYRA_DEFAULT_select,
    unitPickerLabel: LYRA_DEFAULT_unitPickerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _units?: readonly LyraUnitEntry[];

  /** Clone-owned ordered catalog, capped at 1024 rows. Undefined/null restores standard defaults; [] stays empty. */
  @property({ attribute: false })
  get units(): LyraUnitCatalog | undefined { return this._units; }
  set units(value: LyraUnitCatalog | null | undefined) {
    writeCatalogProperty(this, 'units', this._units,
      () => snapshotSelectionCatalog(value, normalizeSelectionValue),
      catalog => { this._units = catalog; },
      () => this.updateValidity());
  }

  protected override get entries(): readonly LyraUnitEntry[] { return this._units ?? defaultEntries; }
  protected override get pickerLabel(): string { return this.localize('unitPickerLabel'); }
  protected override resolveRows(): readonly SelectionCatalogRow[] { return resolveUnitNames(this.entries, this.effectiveLocale); }
}

declare global { interface HTMLElementTagNameMap { 'lr-unit-picker': LyraUnitPicker; } }
