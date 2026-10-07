import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeSelectionValue, snapshotSelectionCatalog, type SelectionCatalogRow } from '../../../internal/selection-catalog.js';
import { getTimeZoneCodes, type LyraTimeZoneCatalog, type LyraTimeZoneEntry } from '../../../time-zones.js';
import { LyraCatalogPickerBase, type LyraCatalogPickerChangeDetail, type LyraCatalogPickerEventMap } from '../catalog-picker-base.js';
import { styles } from './time-zone-picker.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed, LYRA_DEFAULT_timeZonePickerLabel } from '../../../internal/default-strings.generated.js';
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
 * @csspart form-control-label - The field label.
 * @csspart select-trigger - The visible trigger or filter frame.
 * @csspart select-display-input - The committed name or optional filter input.
 * @csspart select-listbox - The offered time zones.
 * @csspart select-option - A time-zone option.
 * @csspart select-option-sub - The time-zone identifier.
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
 * @since 25.5.0
 */
export class LyraTimeZonePicker extends LyraCatalogPickerBase {
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
    timeZonePickerLabel: LYRA_DEFAULT_timeZonePickerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _timeZones?: readonly LyraTimeZoneEntry[];

  /** Clone-owned ordered catalog, capped at 1024 rows. Undefined/null restores runtime defaults; [] stays empty. */
  @property({ attribute: false })
  get timeZones(): LyraTimeZoneCatalog | undefined { return this._timeZones; }
  set timeZones(value: LyraTimeZoneCatalog | null | undefined) {
    const previous = this._timeZones;
    this._timeZones = snapshotSelectionCatalog(value, normalizeSelectionValue);
    this.updateValidity();
    this.requestUpdate('timeZones', previous);
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
