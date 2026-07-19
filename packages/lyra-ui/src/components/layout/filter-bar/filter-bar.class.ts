import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './filter-bar.styles.js';
import '../../forms/select/select.class.js';
import '../../forms/combobox/combobox.class.js';
import '../../forms/combobox/option.class.js';
import '../../forms/date-picker/date-input.class.js';
import '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip-group.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/spinner/spinner.class.js';

/** Which existing Lyra input family renders a given filter -- this component composes these,
 *  it never invents a new filter-input type of its own. `'date'` and `'date-range'` both map
 *  to `<lr-date-input>` (single vs. `mode="range"`); `'select'`/`'combobox'` map to their
 *  same-named counterparts, with `combobox`'s own `multiple` opting into a multi-value filter. */
export type FilterBarControlType = 'select' | 'combobox' | 'date' | 'date-range';

/** One closed-set choice for a `'select'`/`'combobox'` filter. */
export interface FilterBarOption {
  value: string;
  label: string;
}

/**
 * A host-declared filter: which composed control renders it, its choice set (for
 * `select`/`combobox`), and its validation/reset defaults. `id` doubles as this filter's key in
 * `FilterBarValue` and its `data-filter-id` anchor in the rendered DOM.
 */
export interface FilterBarFilterDefinition {
  id: string;
  /** Visible label, forwarded to the composed control's own `label` prop (so it renders through
   *  that control's own label/hint/error chrome) -- caller-supplied content, not routed through
   *  `this.localize()` by this component (the same "data, not UI copy" carve-out a table's own
   *  column headers get). */
  label: string;
  type: FilterBarControlType;
  /** Closed choice set. Required (and meaningful) only for `'select'`/`'combobox'`; ignored for
   *  `'date'`/`'date-range'`. */
  options?: FilterBarOption[];
  placeholder?: string;
  /** Opts a `'combobox'` filter into multi-value selection, mirroring `<lr-combobox>`'s own
   *  `multiple`. Ignored for every other `type`. */
  multiple?: boolean;
  required?: boolean;
  /** What `reset()` restores this filter to. A filter with no `defaultValue` resets to unset
   *  (absent from the post-reset `value`) rather than to some invented empty placeholder. */
  defaultValue?: string | string[];
  /** ISO `YYYY-MM-DD` lower bound, forwarded to `<lr-date-input>`'s own `min`. `'date'`/`'date-range'` only. */
  min?: string;
  /** ISO `YYYY-MM-DD` upper bound, forwarded to `<lr-date-input>`'s own `max`. `'date'`/`'date-range'` only. */
  max?: string;
}

/** One filter's current value: a single string (`'select'`, `'date'`, a non-multiple
 *  `'combobox'`), a string array (a `multiple` `'combobox'`), or `undefined`/`''`/`[]` for
 *  "unset". `'date-range'` uses `<lr-date-input>`'s own single-string range shape
 *  (`"YYYY-MM-DD/YYYY-MM-DD"`), not a two-element array. */
export type FilterBarFieldValue = string | string[] | undefined;

/**
 * The whole filter bar's current state: a plain, JSON-serializable object keyed by
 * `FilterBarFilterDefinition.id`. This is the entire URL-querystring/app-state serialization
 * contract -- this component only reads and writes plain data through `value`, and never touches
 * `location`/`history`/storage itself; the host owns turning this object into (and back out of)
 * a querystring, matching every other Lyra "controlled" component's convention.
 */
export type FilterBarValue = Record<string, FilterBarFieldValue>;

export interface FilterBarInputDetail {
  /** The full current value of every filter, not just the one that changed. */
  value: FilterBarValue;
  /** The filter that changed, or `undefined` when every filter changed at once (a `reset()`). */
  filterId?: string;
}

export interface FilterBarValidityDetail {
  valid: boolean;
  /** Filter ids currently failing their own `required` check. */
  invalidFilterIds: string[];
}

export interface FilterBarResetDetail {
  value: FilterBarValue;
}

export interface LyraFilterBarEventMap {
  'lr-input': CustomEvent<FilterBarInputDetail>;
  'lr-validity-change': CustomEvent<FilterBarValidityDetail>;
  'lr-reset': CustomEvent<FilterBarResetDetail>;
}

const EMPTY_FILTERS: FilterBarFilterDefinition[] = [];
const EMPTY_VALUE: FilterBarValue = {};

/** A filter's value counts as "active" (shown as a chip, counted toward `hasActiveFilters`,
 *  satisfying `required`) once it's neither absent, `''`, nor `[]`. */
function isSet(value: FilterBarFieldValue): boolean {
  if (value == null) return false;
  return Array.isArray(value) ? value.length > 0 : value !== '';
}

/**
 * `<lr-filter-bar>` — a row of dashboard filters, each declared by the host (`filters`) rather
 * than invented by this component: every filter composes an existing Lyra input --
 * `<lr-select>`/`<lr-combobox>` for closed choice sets, `<lr-date-input>` (single or `mode="range"`)
 * for dates -- plus a `<lr-chip-group>` of removable `<lr-chip>`s summarizing the currently-active
 * filters, an `<lr-button>` that resets every filter, and (while `loading`) an `<lr-spinner>`
 * status indicator.
 *
 * Controlled, like every other Lyra data component: `value` is a plain, JSON-serializable object
 * (`FilterBarValue`) the host reads/writes directly -- this component never touches
 * `location`/`history`/storage itself, so turning `value` into (and back out of) a URL
 * querystring or an app state store is entirely the host's own concern. Every edit -- picking an
 * option, committing a date, removing an active-filter chip, or clicking reset -- goes through
 * the same `setFilterValue()` path and emits a single `lr-input` carrying the *full* resulting
 * `value`, not just the changed filter's own value, mirroring `<lr-tool-param-form>`'s identical
 * "always the whole object" event contract.
 *
 * Validation is scoped to each filter definition's own `required` flag: `invalidFilterIds`/
 * `checkValidity()` are always live (plain getters over `filters`/`value`, not cached), and
 * `reportValidity()` additionally reveals every currently-invalid filter's inline error (rendered
 * by that filter's own composed control, via its `errorText`/`required` props -- this component
 * never renders a second, duplicate label/hint/error chrome of its own around an already-chromed
 * control) the same way a blur naturally would. `lr-validity-change` fires whenever the computed
 * `{ valid, invalidFilterIds }` actually changes.
 *
 * Deliberately not form-associated: a dashboard filter bar's state is not a submitted form field,
 * and every value it holds already round-trips through `value` directly -- see `disabled` below,
 * a plain property with no `<fieldset disabled>` cascade, for the same reason.
 *
 * @customElement lr-filter-bar
 * @event lr-input - A filter's value changed (including a chip removal or `reset()`).
 *   `detail: { value, filterId }` -- `value` is always the complete object; `filterId` is the
 *   one filter that changed, or `undefined` for a `reset()`.
 * @event lr-validity-change - The computed `{ valid, invalidFilterIds }` changed.
 * @event lr-reset - `reset()` ran (via the reset button or a direct call). `detail: { value }`.
 * @csspart base - The root `role="group"` wrapper.
 * @csspart controls - The row holding every filter control, the reset button, and the loading status.
 * @csspart filter-control - One filter's composed `<lr-select>`/`<lr-combobox>`/`<lr-date-input>`.
 * @csspart reset-button - The reset `<lr-button>`.
 * @csspart status - The loading `<lr-spinner>`, only rendered while `loading`.
 * @csspart active-filters - The `role="group"` wrapper around the active-filter chip row, only rendered while any filter is set.
 * @csspart chips - The `<lr-chip-group>` inside `active-filters`.
 * @csspart chip - One active-filter `<lr-chip>`.
 */
export class LyraFilterBar extends LyraElement<LyraFilterBarEventMap> {
  static styles = [LyraElement.styles, styles];

  static properties = {
    filters: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
  };

  /** Accessible name for the root `role="group"` wrapper. A plain `aria-label` attribute on the
   *  host itself is honored as a fallback when this is left unset, matching `<lr-control-group>`. */
  @property() label = '';

  /** Disables every composed filter control and the reset button. Plain property -- see the
   *  class doc for why this component isn't form-associated / fieldset-cascaded. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Shows the `status` spinner. Purely presentational -- filters stay editable while `loading`,
   *  since a host typically wants a user to keep refining filters while a previous query is
   *  still in flight; only the reset button (which would otherwise race a fresh, unrequeried
   *  reset against an in-flight fetch for the *previous* value) is disabled by it. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Filters that have been visited (focusout'd) at least once -- gates only the *visual*
   *  inline-error presentation on each composed control, matching every other form control in
   *  this library (`lr-select`/`lr-combobox`/`lr-tool-param-form` all avoid flashing red before
   *  the user has touched anything). */
  @state() private touchedFilters = new Set<string>();

  private _filters: FilterBarFilterDefinition[] = EMPTY_FILTERS;
  private _value: FilterBarValue = EMPTY_VALUE;
  // Guards lr-validity-change so it only fires on an actual change, not on every render --
  // `undefined` guarantees the first computed state always "changes" from it, mirroring
  // lr-tool-param-form's identical lastValidityKey.
  private lastValidityKey: string | undefined;

  /** Host-declared filter definitions, rendered in array order. `null`/`undefined` is treated as
   *  an empty array rather than throwing. */
  get filters(): FilterBarFilterDefinition[] {
    return this._filters;
  }
  set filters(next: FilterBarFilterDefinition[]) {
    const old = this._filters;
    this._filters = Array.isArray(next) ? next : EMPTY_FILTERS;
    this.requestUpdate('filters', old);
  }

  /** The current value of every filter -- see the class doc's serialization contract. Always a
   *  fresh shallow copy; mutating a returned object does not affect this component's own state. */
  get value(): FilterBarValue {
    return { ...this._value };
  }
  set value(next: FilterBarValue) {
    const old = this._value;
    this._value = next ? { ...next } : {};
    this.requestUpdate('value', old);
  }

  /** Whether any filter currently has a value. Also what gates the reset button's own disabled
   *  state and whether the `active-filters` chip row renders at all. */
  get hasActiveFilters(): boolean {
    return this._filters.some((def) => isSet(this._value[def.id]));
  }

  /** Filter ids currently failing their own `required` check -- a filter is invalid only when
   *  `required` is set and its value is unset (see `isSet`). Always live, never cached. */
  get invalidFilterIds(): string[] {
    return this._filters.filter((def) => def.required && !isSet(this._value[def.id])).map((def) => def.id);
  }

  /** Whether every `required` filter currently has a value. Never reveals inline errors on its
   *  own -- see `reportValidity()`. */
  checkValidity(): boolean {
    return this.invalidFilterIds.length === 0;
  }

  /** Like `checkValidity()`, but also marks every currently-invalid filter as touched so its
   *  inline error becomes visible immediately -- the hook a consumer's own "Apply"/search action
   *  should call right before acting, mirroring `<lr-tool-param-form>`'s identical method. */
  reportValidity(): boolean {
    const invalid = this.invalidFilterIds;
    if (invalid.length) this.touchedFilters = new Set([...this.touchedFilters, ...invalid]);
    return invalid.length === 0;
  }

  /** Resets every filter to its own `defaultValue` (or unset, if it declared none), clears
   *  touched state, and emits both `lr-input` (the standard "value changed" event, so a listener
   *  that only listens for that still observes the reset) and `lr-reset` -- mirrors
   *  `<lr-combobox>`'s own `clear()`, which likewise emits its standard value events *plus* a
   *  dedicated `lr-clear`. */
  reset(): void {
    if (this.disabled) return;
    this.touchedFilters = new Set();
    this.value = this.resetValue;
    this.emit<FilterBarInputDetail>('lr-input', { value: this.value, filterId: undefined });
    this.emit<FilterBarResetDetail>('lr-reset', { value: this.value });
  }

  private get resetValue(): FilterBarValue {
    const out: FilterBarValue = {};
    for (const def of this._filters) {
      if (def.defaultValue !== undefined) {
        out[def.id] = Array.isArray(def.defaultValue) ? [...def.defaultValue] : def.defaultValue;
      }
    }
    return out;
  }

  private setFilterValue(id: string, value: FilterBarFieldValue): void {
    if (this.disabled) return;
    this.value = { ...this._value, [id]: value };
    this.emit<FilterBarInputDetail>('lr-input', { value: this.value, filterId: id });
  }

  private markTouched(id: string): void {
    if (this.touchedFilters.has(id)) return;
    this.touchedFilters = new Set(this.touchedFilters).add(id);
  }

  private onControlChange = (id: string, e: Event): void => {
    this.setFilterValue(id, (e.target as HTMLElement & { value: FilterBarFieldValue }).value);
  };

  private clearFilter(id: string): void {
    if (this.disabled) return;
    const def = this._filters.find((f) => f.id === id);
    const empty: FilterBarFieldValue = def?.type === 'combobox' && def.multiple ? [] : '';
    this.setFilterValue(id, empty);
  }

  private displayValueFor(def: FilterBarFilterDefinition, value: FilterBarFieldValue): string {
    if (def.type === 'select' || def.type === 'combobox') {
      const values = Array.isArray(value) ? value : value ? [value] : [];
      // Show each option's own label, not its raw value, when it's a known choice -- falls back
      // to the raw value verbatim for a value that no longer matches any declared option.
      return values.map((v) => def.options?.find((o) => o.value === v)?.label ?? v).join(', ');
    }
    // 'date' / 'date-range': the raw ISO value(s) are caller-supplied data, not UI copy -- not
    // an i18n concern. The '/' range separator is swapped for an en dash purely as display
    // punctuation, mirroring <lr-date-input>'s own displayText join.
    return typeof value === 'string' ? value.replace('/', ' – ') : '';
  }

  private get activeEntries(): { def: FilterBarFilterDefinition; display: string }[] {
    return this._filters
      .filter((def) => isSet(this._value[def.id]))
      .map((def) => ({ def, display: this.displayValueFor(def, this._value[def.id]) }));
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('value') || changed.has('filters')) {
      const invalidFilterIds = this.invalidFilterIds;
      const valid = invalidFilterIds.length === 0;
      const key = JSON.stringify({ valid, invalidFilterIds });
      if (key !== this.lastValidityKey) {
        this.lastValidityKey = key;
        this.emit<FilterBarValidityDetail>('lr-validity-change', { valid, invalidFilterIds });
      }
    }
  }

  private renderControl(def: FilterBarFilterDefinition): TemplateResult {
    const value = this._value[def.id];
    const missing = Boolean(def.required) && !isSet(value);
    const errorText = this.touchedFilters.has(def.id) && missing ? this.localize('fieldRequired') : '';
    const onChange = (e: Event) => this.onControlChange(def.id, e);
    const onFocusout = () => this.markTouched(def.id);

    if (def.type === 'combobox') {
      const multiple = Boolean(def.multiple);
      const comboValue = multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? value : '';
      return html`<lr-combobox
        part="filter-control"
        data-filter-id=${def.id}
        .label=${def.label}
        placeholder=${def.placeholder || ''}
        ?multiple=${multiple}
        ?required=${Boolean(def.required)}
        .errorText=${errorText}
        .value=${comboValue}
        ?disabled=${this.disabled}
        @change=${onChange}
        @focusout=${onFocusout}
        >${(def.options ?? []).map((o) => html`<lr-option value=${o.value}>${o.label}</lr-option>`)}</lr-combobox
      >`;
    }

    if (def.type === 'date' || def.type === 'date-range') {
      return html`<lr-date-input
        part="filter-control"
        data-filter-id=${def.id}
        .label=${def.label}
        placeholder=${def.placeholder || ''}
        .mode=${def.type === 'date-range' ? 'range' : 'single'}
        .min=${def.min || ''}
        .max=${def.max || ''}
        ?required=${Boolean(def.required)}
        .errorText=${errorText}
        .value=${typeof value === 'string' ? value : ''}
        ?disabled=${this.disabled}
        @change=${onChange}
        @focusout=${onFocusout}
      ></lr-date-input>`;
    }

    // 'select' (also the fallback for an unrecognized type, so a filter with a bad `type` still
    // renders a usable, if empty, control instead of vanishing silently).
    return html`<lr-select
      part="filter-control"
      data-filter-id=${def.id}
      .label=${def.label}
      placeholder=${def.placeholder || ''}
      ?required=${Boolean(def.required)}
      .errorText=${errorText}
      .value=${typeof value === 'string' ? value : ''}
      ?disabled=${this.disabled}
      @change=${onChange}
      @focusout=${onFocusout}
      >${(def.options ?? []).map((o) => html`<lr-option value=${o.value}>${o.label}</lr-option>`)}</lr-select
    >`;
  }

  render(): TemplateResult {
    const accessibleLabel = this.label || this.getAttribute('aria-label') || nothing;
    const active = this.activeEntries;
    return html`
      <div part="base" role="group" aria-label=${accessibleLabel}>
        <div part="controls">
          ${this._filters.map((def) => this.renderControl(def))}
          <lr-button
            part="reset-button"
            appearance="quiet"
            size="s"
            ?disabled=${this.disabled || this.loading || !this.hasActiveFilters}
            @click=${() => this.reset()}
          >
            ${this.localize('filterBarReset')}
          </lr-button>
          ${this.loading ? html`<lr-spinner part="status"></lr-spinner>` : nothing}
        </div>
        ${active.length > 0
          ? html`<div
              part="active-filters"
              role="group"
              aria-label=${this.localize('filterBarActiveFilters')}
            >
              <lr-chip-group part="chips">
                ${active.map(
                  ({ def, display }) => html`<lr-chip
                    part="chip"
                    removable
                    value=${def.id}
                    @lr-remove=${() => this.clearFilter(def.id)}
                    >${def.label}: ${display}</lr-chip
                  >`,
                )}
              </lr-chip-group>
            </div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-filter-bar': LyraFilterBar;
  }
}
