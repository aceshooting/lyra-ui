import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { writeCatalogProperty, normalizeSelectionValue, snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { getTimeZoneCodes, type LyraTimeZoneCatalog, type LyraTimeZoneEntry } from '../../../time-zones.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { styles } from './time-zone-picker.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_catalogPickerSearchLoadFailed, LYRA_DEFAULT_timeZonePickerLabel } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_catalogPickerInputLimit, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_retry, LYRA_DEFAULT_select } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type { LyraTimeZoneCatalog, LyraTimeZoneEntry } from '../../../time-zones.js';
export type LyraTimeZoneChangeDetail = LyraCatalogPickerChangeDetail;
export interface LyraTimeZonePickerEventMap extends LyraCatalogPickerEventMap {}
let defaultEntries: readonly LyraTimeZoneEntry[] | undefined;

/**
 * `<lr-time-zone-picker>` — a form-associated time-zone identifier selector.
 * Defaults to UTC and the runtime's supported IANA identifiers without choosing a zone.
 * Default labels retain the identifier, replacing underscores with spaces for readability.
 * Supply an explicit catalog to keep server and client inventories identical.
 * Opt-in searchable filters identifiers and labels without changing the committed form value.
 * Catalogs preserve caller order and contiguous groups. Identifiers are trimmed, case-sensitive
 * and never canonicalized. Unavailable or disabled values remain visible and invalid.
 * Programmatic changes and reset emit no selection events. Selection does not change the
 * application's time zone or calculate offsets, clocks or daylight-saving transitions.
 *
 * @customElement lr-time-zone-picker
 * @slot label - Custom field label.
 * @slot hint - Custom field guidance.
 * @slot error - Custom validation guidance.
 * @csspart form-control - The field wrapper.
 * @cssprop [--lr-form-control-label-font-size=var(--lr-font-size-md-sm)] - Font size of the field label.
 * @cssprop [--lr-form-control-label-font-weight=var(--lr-font-weight-semibold)] - Font weight of the field label.
 * @cssprop [--lr-form-control-label-color=inherit] - Text color of the field label.
 * @cssprop [--lr-form-control-label-inline-size=30%] - Label column width while
 *   `label-placement="start"`; `auto` sizes the column to the label text.
 * @cssprop [--lr-form-control-label-gap] - Space between the label and the field: the label
 *   column gap while `label-placement="start"` (default `var(--lr-space-m)`), and the gap under a
 *   label above the field, in top placement or a collapsed start row (default `var(--lr-space-xs)`).
 * @cssprop [--lr-form-control-label-collapse-inline-size=var(--lr-size-20rem)] - Control width
 *   below which `label-placement="start"` returns the label above the field.
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The visible trigger or filter frame.
 * @csspart select-display-input - The committed name or optional filter input.
 * @csspart select-listbox - The offered time zones.
 * @csspart select-option-overflow - Count of rows outside the 1,000-option popup ceiling; searchable mode can filter to them.
 * @csspart select-option - A time-zone option.
 * @csspart select-option-sub - The time-zone identifier.
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
export class LyraTimeZonePicker extends LyraCatalogPickerBase {
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
    timeZonePickerLabel: LYRA_DEFAULT_timeZonePickerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _timeZones?: readonly LyraTimeZoneEntry[];

  /** Clone-owned ordered catalog, capped at 1024 rows. Undefined/null restores runtime defaults; [] stays empty. */
  @property({ attribute: false })
  get timeZones(): LyraTimeZoneCatalog | undefined { return this._timeZones; }
  set timeZones(value: LyraTimeZoneCatalog | null | undefined) {
    writeCatalogProperty(this, 'timeZones', this._timeZones,
      () => snapshotSelectionCatalog(value, normalizeSelectionValue),
      catalog => { this._timeZones = catalog; },
      () => this.updateValidity());
  }

  protected override get entries(): readonly LyraTimeZoneEntry[] {
    return this._timeZones ?? (defaultEntries ??= Object.freeze(getTimeZoneCodes().map((code) => Object.freeze({ code }))));
  }
  protected override get pickerLabel(): string { return this.localize('timeZonePickerLabel'); }
  protected override resolveRows(): readonly SelectionCatalogRow[] {
    return Object.freeze(this.entries.map((entry) => {
      const readableName = entry.code.replace(/_/g, ' ');
      const label = entry.label ?? readableName;
      return Object.freeze({ ...entry, label, searchText: [entry.code, readableName, label].join(' ') });
    }));
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-time-zone-picker': LyraTimeZonePicker; } }
