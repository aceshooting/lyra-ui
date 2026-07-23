import { html, nothing, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import '../../forms/select/select.class.js';
import '../../forms/combobox/option.class.js';
import '../../forms/combobox/combobox.class.js';
import '../../forms/input/input.class.js';
import '../../forms/date-picker/date-input.class.js';
import '../../forms/button/button.class.js';
import '../../forms/icon-button/icon-button.class.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import type { LyraDateInput } from '../../forms/date-picker/date-input.class.js';
import { styles } from './query-builder.styles.js';

/** The kind of value a `QueryBuilderField` holds — drives which existing sibling control
 *  (`lr-input`/`lr-select`/`lr-date-input`/`lr-combobox`) renders for a condition row's value
 *  cell, and which `QueryBuilderOperator`s are offered by default. */
export type QueryBuilderFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum';

/** A comparison a condition row can apply. `gt`/`gte`/`lt`/`lte` are shared by `number` and
 *  `date` fields (labelled "Greater than"/"After" etc. depending on the field's own `type`, see
 *  `operatorLabel()`) rather than duplicated as separate date-only tokens, so a host swapping a
 *  field's `type` between the two doesn't need to remap any already-selected operator. `in`/
 *  `notIn` only apply to `enum` fields (rendered as a multi-select `lr-combobox`); `isEmpty`/
 *  `isNotEmpty` are unary and render no value control at all. */
export type QueryBuilderOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

/** One selectable value for an `enum`-typed `QueryBuilderField`. */
export interface QueryBuilderFieldOption {
  value: string;
  label?: string;
}

/** One field a host makes available for building conditions against. */
export interface QueryBuilderField {
  /** Machine key, matched against a `QueryBuilderCondition`'s own `field`. */
  name: string;
  /** Visible label; falls back to `name` when omitted. */
  label?: string;
  type: QueryBuilderFieldType;
  /** Required (and only meaningful) for `type: 'enum'` — the choices offered for `eq`/`neq`
   *  (single `lr-select`) and `in`/`notIn` (multi `lr-combobox`). */
  options?: QueryBuilderFieldOption[];
  /** Overrides the default operator set for this field's `type` (see `defaultOperatorsForType()`).
   *  Lets a host narrow (or reorder) the operators offered for a specific field, e.g. a
   *  free-text field that should only ever offer `contains`. */
  operators?: QueryBuilderOperator[];
  /** Forwarded to the rendered `lr-input` for a `string`-typed field's value cell. */
  placeholder?: string;
}

/** A single field/operator/value row. `field`/`operator` are `''` until the user has picked
 *  one — an incomplete row is a normal, valid intermediate state, not an error. `value` is
 *  `undefined` for a unary operator (`isEmpty`/`isNotEmpty`), a `string[]` for `in`/`notIn`,
 *  and a `string | number | boolean` otherwise, matching the selected field's `type`. */
export interface QueryBuilderCondition {
  id: string;
  field: string;
  operator: QueryBuilderOperator | '';
  value?: string | number | boolean | string[];
}

export type QueryBuilderCombinator = 'and' | 'or';

/** The whole builder's serializable state: a flat list of conditions combined with one
 *  top-level `combinator` — plain data, safe to persist, restore, or send to a backend as-is.
 *  This library's `lr-filter-bar` (a sibling orchestration component) follows the same
 *  controlled-plain-object-`value` shape for its own filter state. */
export interface QueryBuilderValue {
  combinator: QueryBuilderCombinator;
  conditions: QueryBuilderCondition[];
}

export interface LyraQueryBuilderEventMap {
  /** Fired whenever `value` changes as a result of user interaction (picking a field/operator,
   *  editing a value, changing the combinator, or adding/removing a row) — never for a
   *  programmatic `value`/`fields` assignment. `detail.value` is the full current value. */
  'lr-input': CustomEvent<{ value: QueryBuilderValue }>;
  /** Fired after a new (blank) condition row is appended, whether triggered by the "Add
   *  condition" button or a public `addCondition()` call. */
  'lr-add-condition': CustomEvent<{ condition: QueryBuilderCondition }>;
  /** Fired after a condition row is removed. */
  'lr-remove-condition': CustomEvent<{ id: string }>;
}

const EMPTY_FIELDS: QueryBuilderField[] = [];
const EMPTY_VALUE: QueryBuilderValue = { combinator: 'and', conditions: [] };

const STRING_OPERATORS: readonly QueryBuilderOperator[] = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPERATORS: readonly QueryBuilderOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
const BOOLEAN_OPERATORS: readonly QueryBuilderOperator[] = ['eq', 'neq'];
const DATE_OPERATORS: readonly QueryBuilderOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
const ENUM_OPERATORS: readonly QueryBuilderOperator[] = ['eq', 'neq', 'in', 'notIn', 'isEmpty', 'isNotEmpty'];

/** The built-in operator vocabulary for a field's `type`, before a per-field `operators`
 *  override is applied — see `QueryBuilderField.operators`. */
function defaultOperatorsForType(type: QueryBuilderFieldType): readonly QueryBuilderOperator[] {
  switch (type) {
    case 'string':
      return STRING_OPERATORS;
    case 'number':
      return NUMBER_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    case 'date':
      return DATE_OPERATORS;
    case 'enum':
      return ENUM_OPERATORS;
  }
}

function isUnaryOperator(op: QueryBuilderOperator | ''): boolean {
  return op === 'isEmpty' || op === 'isNotEmpty';
}

function isMultiOperator(op: QueryBuilderOperator | ''): boolean {
  return op === 'in' || op === 'notIn';
}

/**
 * `<lr-query-builder>` — a composable structured-query builder for tabular/dashboard data: a
 * flat list of field/operator/value condition rows combined with one AND/OR combinator.
 *
 * Distinct from this package's `<lr-graph-query-builder>`: that component builds typed
 * relationship/path queries over a knowledge graph, a genuinely different data model from this
 * one's flat tabular field/operator/value conditions — they never share a file or a value type.
 *
 * Fully controlled: a host supplies `fields` (the available columns, each with a
 * `QueryBuilderFieldType` that determines its offered operators and value control) and `value`
 * (a plain, serializable `{ combinator, conditions }` object — safe to persist or send to a
 * backend as-is, the same shape convention as this package's `<lr-rubric-form>`/`<lr-filter-bar>`).
 * This component never mutates `fields`/`value` in place or calls out to storage/network itself;
 * every change is surfaced through `value`/`lr-input` for the host to own.
 *
 * Each row composes `<lr-select>` for the field and operator pickers, and a value control chosen
 * from the selected field's `type`: `<lr-input type="text">` (`string`), `<lr-input
 * type="number">` (`number`), `<lr-select>` with `True`/`False` options (`boolean`),
 * `<lr-date-input>` (`date`), `<lr-select>` (`enum`, `eq`/`neq`) or a multi-select
 * `<lr-combobox>` (`enum`, `in`/`notIn`). A unary operator (`isEmpty`/`isNotEmpty`) renders no
 * value control. `<lr-icon-button icon="trash">` removes a row; `<lr-button>` appends one.
 *
 * This is a composite query-definition control, not a single submittable form field — it
 * deliberately ships no `label`/`hint`/`errorText` chrome or native form association (the
 * `label`/`hint`/`error` triad those controls share doesn't fit a multi-row, multi-field
 * composite the way it fits one value). A host names the whole control via a plain `aria-label`
 * attribute, applied to the element that owns `role="group"`.
 *
 * @customElement lr-query-builder
 * @event lr-input - `detail: { value }` — the full current value, after any user-driven change.
 * @event lr-add-condition - `detail: { condition }` — a new blank row was appended.
 * @event lr-remove-condition - `detail: { id }` — a row was removed.
 * @csspart base - The outer wrapper.
 * @csspart combinator - The AND/OR combinator `lr-select`, rendered only when there are 2+ conditions.
 * @csspart conditions - The wrapper around the condition rows.
 * @csspart condition - One field/operator/value row.
 * @csspart field-select - A row's field `lr-select`.
 * @csspart operator-select - A row's operator `lr-select`.
 * @csspart value - A row's value control (whichever of `lr-input`/`lr-select`/`lr-date-input`/
 *   `lr-combobox` applies, or an empty placeholder for a unary operator or an incomplete row).
 * @csspart remove-button - A row's remove `lr-icon-button`.
 * @csspart add-button - The "Add condition" `lr-button`.
 * @csspart empty - The message shown when there are no fields, or no conditions yet.
 */
export class LyraQueryBuilder extends LyraElement<LyraQueryBuilderEventMap> {
  static override styles = [LyraElement.styles, styles];

  static override properties = {
    fields: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _fields: QueryBuilderField[] = EMPTY_FIELDS;
  private _value: QueryBuilderValue = EMPTY_VALUE;
  private _disabled = false;
  // Set right before a condition row is removed when focus was inside that row -- consumed by
  // updated() to move focus to the add-button, so removing the focused row's remove-button
  // doesn't silently drop focus to the document body.
  private pendingFocusAdd = false;

  /** The fields available to build conditions against. */
  get fields(): QueryBuilderField[] {
    return this._fields;
  }
  set fields(next: QueryBuilderField[]) {
    const old = this._fields;
    this._fields = next ?? EMPTY_FIELDS;
    this.requestUpdate('fields', old);
  }

  /** The current query: one combinator plus a flat list of conditions. Controlled — assigning
   *  this directly never emits `lr-input` (that only fires for a user-driven change); see the
   *  class doc's form-association note for why this stays a plain property, not a form value. */
  get value(): QueryBuilderValue {
    return this._value;
  }
  set value(next: QueryBuilderValue) {
    const old = this._value;
    this._value = next ?? EMPTY_VALUE;
    this.requestUpdate('value', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  private operatorsFor(field: QueryBuilderField | undefined): readonly QueryBuilderOperator[] {
    if (!field) return [];
    return field.operators && field.operators.length > 0 ? field.operators : defaultOperatorsForType(field.type);
  }

  private operatorLabel(op: QueryBuilderOperator, type: QueryBuilderFieldType | undefined): string {
    switch (op) {
      case 'eq':
        return this.localize('queryBuilderOperatorEquals');
      case 'neq':
        return this.localize('queryBuilderOperatorNotEquals');
      case 'gt':
        return type === 'date' ? this.localize('queryBuilderOperatorAfter') : this.localize('queryBuilderOperatorGreaterThan');
      case 'gte':
        return type === 'date' ? this.localize('queryBuilderOperatorOnOrAfter') : this.localize('queryBuilderOperatorGreaterThanOrEqual');
      case 'lt':
        return type === 'date' ? this.localize('queryBuilderOperatorBefore') : this.localize('queryBuilderOperatorLessThan');
      case 'lte':
        return type === 'date' ? this.localize('queryBuilderOperatorOnOrBefore') : this.localize('queryBuilderOperatorLessThanOrEqual');
      case 'contains':
        return this.localize('queryBuilderOperatorContains');
      case 'startsWith':
        return this.localize('queryBuilderOperatorStartsWith');
      case 'endsWith':
        return this.localize('queryBuilderOperatorEndsWith');
      case 'in':
        return this.localize('queryBuilderOperatorIn');
      case 'notIn':
        return this.localize('queryBuilderOperatorNotIn');
      case 'isEmpty':
        return this.localize('queryBuilderOperatorIsEmpty');
      case 'isNotEmpty':
        return this.localize('queryBuilderOperatorIsNotEmpty');
    }
  }

  /** The value a condition should reset to whenever its `field` or `operator` changes -- always
   *  a fresh, type-appropriate default rather than attempting to carry over a value that may no
   *  longer match the new field's type or the new operator's arity. */
  private defaultValueFor(fieldName: string, operator: QueryBuilderOperator | ''): QueryBuilderCondition['value'] {
    if (operator === '' || isUnaryOperator(operator)) return undefined;
    if (isMultiOperator(operator)) return [];
    const field = this._fields.find((f) => f.name === fieldName);
    if (field?.type === 'number' || field?.type === 'boolean') return undefined;
    return '';
  }

  private commit(next: QueryBuilderValue): void {
    this.value = next;
    this.emit('lr-input', { value: this._value });
  }

  /** Appends a new, blank condition row (empty `field`/`operator`). */
  addCondition(): void {
    if (this.disabled) return;
    const condition: QueryBuilderCondition = { id: nextId('query-condition'), field: '', operator: '' };
    this.commit({ ...this._value, conditions: [...this._value.conditions, condition] });
    this.emit('lr-add-condition', { condition });
  }

  /** Removes the condition row with the given `id`, if present. */
  removeCondition(id: string): void {
    if (this.disabled) return;
    if (!this._value.conditions.some((c) => c.id === id)) return;
    const row = this.shadowRoot?.querySelector(`[part="condition"][data-id="${CSS.escape(id)}"]`);
    const active = this.shadowRoot?.activeElement;
    if (row && active && row.contains(active)) this.pendingFocusAdd = true;
    const conditions = this._value.conditions.filter((c) => c.id !== id);
    this.commit({ ...this._value, conditions });
    this.emit('lr-remove-condition', { id });
  }

  private setCombinator(combinator: QueryBuilderCombinator): void {
    if (this.disabled || combinator === this._value.combinator) return;
    this.commit({ ...this._value, combinator });
  }

  private setConditionField(id: string, field: string): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) => (c.id === id ? { id: c.id, field, operator: '' as const, value: undefined } : c));
    this.commit({ ...this._value, conditions });
  }

  private setConditionOperator(id: string, operator: QueryBuilderOperator | ''): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) =>
      c.id === id ? { ...c, operator, value: this.defaultValueFor(c.field, operator) } : c,
    );
    this.commit({ ...this._value, conditions });
  }

  private setConditionValue(id: string, value: QueryBuilderCondition['value']): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) => (c.id === id ? { ...c, value } : c));
    this.commit({ ...this._value, conditions });
  }

  private consumeChildEvent(event: Event, action: () => void): void {
    event.stopPropagation();
    action();
  }

  protected override updated(): void {
    if (this.pendingFocusAdd) {
      this.pendingFocusAdd = false;
      (this.renderRoot.querySelector('[part="add-button"]') as (HTMLElement & { focus(): void }) | null)?.focus();
    }
  }

  private renderCombinator(combinator: QueryBuilderCombinator): TemplateResult {
    return html`
      <lr-select
        part="combinator"
        size="s"
        aria-label=${this.localize('queryBuilderCombinatorLabel')}
        .value=${combinator}
        ?disabled=${this.disabled}
        @change=${(event: Event) =>
          this.consumeChildEvent(event, () =>
            this.setCombinator((event.target as LyraSelect).value as QueryBuilderCombinator),
          )}
      >
        <lr-option value="and">${this.localize('queryBuilderCombinatorAnd')}</lr-option>
        <lr-option value="or">${this.localize('queryBuilderCombinatorOr')}</lr-option>
      </lr-select>
    `;
  }

  private renderValueControl(condition: QueryBuilderCondition, field: QueryBuilderField | undefined): TemplateResult {
    const valueLabel = this.localize('queryBuilderValueLabel');
    if (!field || condition.operator === '' || isUnaryOperator(condition.operator)) {
      return html`<span part="value" class="value-placeholder" aria-hidden="true"></span>`;
    }
    if (isMultiOperator(condition.operator)) {
      const selected = Array.isArray(condition.value) ? condition.value : [];
      return html`
        <lr-combobox
          part="value"
          size="s"
          multiple
          aria-label=${valueLabel}
          .value=${selected}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionValue(condition.id, (event.target as LyraCombobox).value as string[]),
            )}
        >
          ${(field.options ?? []).map((o) => html`<lr-option value=${o.value}>${o.label ?? o.value}</lr-option>`)}
        </lr-combobox>
      `;
    }
    if (field.type === 'boolean') {
      const current = condition.value === true ? 'true' : condition.value === false ? 'false' : '';
      return html`
        <lr-select
          part="value"
          size="s"
          aria-label=${valueLabel}
          placeholder=${this.localize('queryBuilderValuePlaceholder')}
          .value=${current}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionValue(condition.id, (event.target as LyraSelect).value === 'true'),
            )}
        >
          <lr-option value="true">${this.localize('queryBuilderBooleanTrue')}</lr-option>
          <lr-option value="false">${this.localize('queryBuilderBooleanFalse')}</lr-option>
        </lr-select>
      `;
    }
    if (field.type === 'date') {
      const current = typeof condition.value === 'string' ? condition.value : '';
      return html`
        <lr-date-input
          part="value"
          size="s"
          aria-label=${valueLabel}
          .value=${current}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionValue(condition.id, (event.target as LyraDateInput).value),
            )}
        ></lr-date-input>
      `;
    }
    if (field.type === 'enum') {
      const current = typeof condition.value === 'string' ? condition.value : '';
      return html`
        <lr-select
          part="value"
          size="s"
          aria-label=${valueLabel}
          placeholder=${this.localize('queryBuilderValuePlaceholder')}
          .value=${current}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionValue(condition.id, (event.target as LyraSelect).value),
            )}
        >
          ${(field.options ?? []).map((o) => html`<lr-option value=${o.value}>${o.label ?? o.value}</lr-option>`)}
        </lr-select>
      `;
    }
    if (field.type === 'number') {
      const current = typeof condition.value === 'number' ? String(condition.value) : '';
      return html`
        <lr-input
          part="value"
          type="number"
          size="s"
          aria-label=${valueLabel}
          .value=${current}
          ?disabled=${this.disabled}
          @input=${(event: Event) =>
            this.consumeChildEvent(event, () => {
              const raw = (event.target as LyraInput).value;
              const parsed = raw === '' ? undefined : Number(raw);
              this.setConditionValue(condition.id, parsed !== undefined && Number.isNaN(parsed) ? undefined : parsed);
            })}
        ></lr-input>
      `;
    }
    const current = typeof condition.value === 'string' ? condition.value : '';
    return html`
      <lr-input
        part="value"
        type="text"
        size="s"
        placeholder=${field.placeholder ?? ''}
        aria-label=${valueLabel}
        .value=${current}
        ?disabled=${this.disabled}
        @input=${(event: Event) =>
          this.consumeChildEvent(event, () =>
            this.setConditionValue(condition.id, (event.target as LyraInput).value),
          )}
      ></lr-input>
    `;
  }

  private renderCondition(condition: QueryBuilderCondition, index: number): TemplateResult {
    const field = this._fields.find((f) => f.name === condition.field);
    const operators = this.operatorsFor(field);
    return html`
      <div part="condition" data-id=${condition.id}>
        <lr-select
          part="field-select"
          size="s"
          aria-label=${this.localize('queryBuilderFieldLabel')}
          placeholder=${this.localize('queryBuilderFieldPlaceholder')}
          .value=${condition.field}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionField(condition.id, (event.target as LyraSelect).value),
            )}
        >
          ${this._fields.map((f) => html`<lr-option value=${f.name}>${f.label ?? f.name}</lr-option>`)}
        </lr-select>

        <lr-select
          part="operator-select"
          size="s"
          aria-label=${this.localize('queryBuilderOperatorLabel')}
          placeholder=${this.localize('queryBuilderOperatorPlaceholder')}
          .value=${condition.operator}
          ?disabled=${this.disabled || !field}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionOperator(condition.id, (event.target as LyraSelect).value as QueryBuilderOperator),
            )}
        >
          ${operators.map((op) => html`<lr-option value=${op}>${this.operatorLabel(op, field?.type)}</lr-option>`)}
        </lr-select>

        ${this.renderValueControl(condition, field)}

        <lr-icon-button
          part="remove-button"
          icon="trash"
          aria-label=${this.localize('queryBuilderRemoveCondition', undefined, { index: index + 1 })}
          ?disabled=${this.disabled}
          @click=${() => this.removeCondition(condition.id)}
        ></lr-icon-button>
      </div>
    `;
  }

  override render(): TemplateResult {
    const hasFields = this._fields.length > 0;
    const value = this._value;
    return html`
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || this.localize('queryBuilderLabel')}>
        ${!hasFields
          ? html`<p part="empty">${this.localize('queryBuilderNoFields')}</p>`
          : html`
              ${value.conditions.length > 1 ? this.renderCombinator(value.combinator) : nothing}
              ${value.conditions.length === 0
                ? html`<p part="empty">${this.localize('queryBuilderEmpty')}</p>`
                : html`<div part="conditions">${value.conditions.map((c, i) => this.renderCondition(c, i))}</div>`}
              <lr-button
                part="add-button"
                appearance="outlined"
                size="s"
                ?disabled=${this.disabled}
                @click=${() => this.addCondition()}
              >
                ${this.localize('queryBuilderAddCondition')}
              </lr-button>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-query-builder': LyraQueryBuilder;
  }
}
