import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import type { PropertyValues } from 'lit';
import { html, nothing, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import type { LyraDateInput } from '../../forms/date-picker/date-input.class.js';
import { styles } from './condition-builder.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_queryBuilderAddCondition, LYRA_DEFAULT_queryBuilderBooleanFalse, LYRA_DEFAULT_queryBuilderBooleanTrue, LYRA_DEFAULT_queryBuilderCombinatorAnd, LYRA_DEFAULT_queryBuilderCombinatorLabel, LYRA_DEFAULT_queryBuilderCombinatorOr, LYRA_DEFAULT_queryBuilderEmpty, LYRA_DEFAULT_queryBuilderFieldLabel, LYRA_DEFAULT_queryBuilderFieldPlaceholder, LYRA_DEFAULT_queryBuilderLabel, LYRA_DEFAULT_queryBuilderNoFields, LYRA_DEFAULT_queryBuilderOperatorAfter, LYRA_DEFAULT_queryBuilderOperatorBefore, LYRA_DEFAULT_queryBuilderOperatorContains, LYRA_DEFAULT_queryBuilderOperatorEndsWith, LYRA_DEFAULT_queryBuilderOperatorEquals, LYRA_DEFAULT_queryBuilderOperatorGreaterThan, LYRA_DEFAULT_queryBuilderOperatorGreaterThanOrEqual, LYRA_DEFAULT_queryBuilderOperatorIn, LYRA_DEFAULT_queryBuilderOperatorIsEmpty, LYRA_DEFAULT_queryBuilderOperatorIsNotEmpty, LYRA_DEFAULT_queryBuilderOperatorLabel, LYRA_DEFAULT_queryBuilderOperatorLessThan, LYRA_DEFAULT_queryBuilderOperatorLessThanOrEqual, LYRA_DEFAULT_queryBuilderOperatorNotEquals, LYRA_DEFAULT_queryBuilderOperatorNotIn, LYRA_DEFAULT_queryBuilderOperatorOnOrAfter, LYRA_DEFAULT_queryBuilderOperatorOnOrBefore, LYRA_DEFAULT_queryBuilderOperatorPlaceholder, LYRA_DEFAULT_queryBuilderOperatorStartsWith, LYRA_DEFAULT_queryBuilderRemoveCondition, LYRA_DEFAULT_queryBuilderValueLabel, LYRA_DEFAULT_queryBuilderValuePlaceholder } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The kind of value a `ConditionBuilderField` holds — drives which existing sibling control
 *  (`lr-input`/`lr-select`/`lr-date-input`/`lr-combobox`) renders for a condition row's value
 *  cell, and which `ConditionBuilderOperator`s are offered by default. */
/** `<lr-select>`'s `value` widened to `string | string[]` when it gained `multiple`. Every select
 *  this component renders is single-select, so narrow at the boundary rather than threading a
 *  union through the condition model. */
function selectValue(el: LyraSelect): string {
  return Array.isArray(el.value) ? (el.value[0] ?? '') : el.value;
}

export type ConditionBuilderFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum';

/** A comparison a condition row can apply. `gt`/`gte`/`lt`/`lte` are shared by `number` and
 *  `date` fields (labelled "Greater than"/"After" etc. depending on the field's own `type`, see
 *  `operatorLabel()`) rather than duplicated as separate date-only tokens, so a host swapping a
 *  field's `type` between the two doesn't need to remap any already-selected operator. `in`/
 *  `notIn` only apply to `enum` fields (rendered as a multi-select `lr-combobox`); `isEmpty`/
 *  `isNotEmpty` are unary and render no value control at all. */
export type ConditionBuilderOperator =
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

/** One selectable value for an `enum`-typed `ConditionBuilderField`. */
export interface ConditionBuilderFieldOption {
  readonly value: string;
  readonly label?: string;
}

/** One field a host makes available for building conditions against. */
export interface ConditionBuilderField {
  /** Machine key, matched against a `ConditionBuilderCondition`'s own `field`. */
  readonly name: string;
  /** Visible label; falls back to `name` when omitted. */
  readonly label?: string;
  readonly type: ConditionBuilderFieldType;
  /** Required (and only meaningful) for `type: 'enum'` — the choices offered for `eq`/`neq`
   *  (single `lr-select`) and `in`/`notIn` (multi `lr-combobox`). */
  readonly options?: readonly ConditionBuilderFieldOption[];
  /** Overrides the default operator set for this field's `type` (see `defaultOperatorsForType()`).
   *  Lets a host narrow (or reorder) the operators offered for a specific field, e.g. a
   *  free-text field that should only ever offer `contains`. */
  readonly operators?: readonly ConditionBuilderOperator[];
  /** Forwarded to the rendered `lr-input` for a `string`-typed field's value cell. */
  readonly placeholder?: string;
  /** Inclusive lower constraint. A finite number is forwarded by `type: 'number'`; a bounded date
   * string is forwarded by `type: 'date'`. Other field types ignore it. */
  readonly min?: number | string;
  /** Inclusive upper constraint, with the same number/date type-dependent forwarding as `min`. */
  readonly max?: number | string;
  /** Positive finite step forwarded to the numeric `lr-input`; ignored by every other field type. */
  readonly step?: number;
}

/** A single field/operator/value row. `field`/`operator` are `''` until the user has picked
 *  one — an incomplete row is a normal, valid intermediate state, not an error. `value` is
 *  `undefined` for a unary operator (`isEmpty`/`isNotEmpty`), a `string[]` for `in`/`notIn`,
 *  and a `string | number | boolean` otherwise, matching the selected field's `type`. Those are
 *  the valid authored shapes; incompatible controlled payloads are retained and reported through
 *  `validationIssues` rather than silently rewritten. */
export interface ConditionBuilderCondition {
  readonly id: string;
  readonly field: string;
  readonly operator: ConditionBuilderOperator | '';
  readonly value?: string | number | boolean | readonly string[];
}

export type ConditionBuilderCombinator = 'and' | 'or';

/** The whole builder's plain-data state: a flat list of conditions combined with one top-level
 *  `combinator`. It can be persisted and restored without the component repairing operator/value
 *  disagreements; call `checkValidity()` before sending a restored model to a backend. This
 *  library's `lr-filter-bar` follows the same controlled-plain-object-`value` shape. */
export interface ConditionBuilderValue {
  readonly combinator: ConditionBuilderCombinator;
  readonly conditions: readonly ConditionBuilderCondition[];
}

/** Why one controlled condition is inconsistent with the current field metadata. Controlled
 * values remain unchanged; these codes let a host decide whether and how to repair persisted data. */
export type ConditionBuilderValidationIssueCode =
  | 'field-unavailable'
  | 'operator-not-allowed'
  | 'operator-arity'
  | 'value-type';

/** One live validation result for a retained condition. At most one issue is reported per row,
 * ordered by field, operator, arity, then value type so repairing it reveals the next boundary. */
export interface ConditionBuilderValidationIssue {
  readonly conditionId: string;
  readonly code: ConditionBuilderValidationIssueCode;
}

export interface LyraConditionBuilderEventMap {
  /** Fired whenever `value` changes as a result of user interaction (picking a field/operator,
   *  editing a value, changing the combinator, or adding/removing a row) — never for a
   *  programmatic `value`/`fields` assignment. `detail.value` is the full current value. */
  'lr-input': CustomEvent<LyraEventDetailSnapshot<{ readonly value: ConditionBuilderValue }>>;
  /** Fired after a new condition row seeded with the first available field is appended, whether
   *  triggered by the button or a public `addCondition()` call. */
  'lr-add-condition': CustomEvent<LyraEventDetailSnapshot<{ readonly condition: ConditionBuilderCondition }>>;
  /** Fired after a condition row is removed. */
  'lr-remove-condition': CustomEvent<{ readonly conditionId: string }>;
}

const MAX_FIELDS = 200;
const MAX_CONDITIONS = 200;
const MAX_OPTIONS = 500;
const MAX_TEXT = 256;

const EMPTY_FIELDS: readonly ConditionBuilderField[] = Object.freeze([]);
const EMPTY_OPTIONS: readonly ConditionBuilderFieldOption[] = Object.freeze([]);
const EMPTY_VALUE: ConditionBuilderValue = Object.freeze({ combinator: 'and', conditions: Object.freeze([]) });

const STRING_OPERATORS: readonly ConditionBuilderOperator[] = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPERATORS: readonly ConditionBuilderOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
const BOOLEAN_OPERATORS: readonly ConditionBuilderOperator[] = ['eq', 'neq'];
const DATE_OPERATORS: readonly ConditionBuilderOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
const ENUM_OPERATORS: readonly ConditionBuilderOperator[] = ['eq', 'neq', 'in', 'notIn', 'isEmpty', 'isNotEmpty'];

/** The built-in operator vocabulary for a field's `type`, before a per-field `operators`
 *  override is applied — see `ConditionBuilderField.operators`. */
function defaultOperatorsForType(type: ConditionBuilderFieldType): readonly ConditionBuilderOperator[] {
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

function isUnaryOperator(op: ConditionBuilderOperator | ''): boolean {
  return op === 'isEmpty' || op === 'isNotEmpty';
}

function isMultiOperator(op: ConditionBuilderOperator | ''): boolean {
  return op === 'in' || op === 'notIn';
}

const FIELD_TYPES = new Set<ConditionBuilderFieldType>(['string', 'number', 'boolean', 'date', 'enum']);
const OPERATORS = new Set<ConditionBuilderOperator>([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'in', 'notIn',
  'isEmpty', 'isNotEmpty',
]);

/** Read an own data property without invoking a consumer-provided getter. */
function ownValue(record: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

function optionalFiniteNumber(value: unknown, positive = false): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = finiteNumber(value, 0);
  return !positive || normalized > 0 ? normalized : undefined;
}

function normalizeOptions(value: unknown): readonly ConditionBuilderFieldOption[] {
  if (!Array.isArray(value)) return EMPTY_OPTIONS;
  const seen = new Set<string>();
  const result: ConditionBuilderFieldOption[] = [];
  for (const candidate of value.slice(0, MAX_OPTIONS)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const optionValue = boundedString(ownValue(candidate, 'value'));
    if (optionValue.trim().length === 0 || seen.has(optionValue)) continue;
    seen.add(optionValue);
    const label = boundedString(ownValue(candidate, 'label'));
    result.push(Object.freeze({ value: optionValue, ...(label ? { label } : {}) }));
  }
  return Object.freeze(result);
}

function normalizeOperators(value: unknown): readonly ConditionBuilderOperator[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = [...new Set(value
    .slice(0, MAX_OPTIONS)
    .filter((entry): entry is ConditionBuilderOperator => OPERATORS.has(entry as ConditionBuilderOperator)))];
  return result.length > 0 ? Object.freeze(result) : undefined;
}

function normalizeFields(value: unknown): readonly ConditionBuilderField[] {
  if (!Array.isArray(value)) return EMPTY_FIELDS;
  const names = new Set<string>();
  const result: ConditionBuilderField[] = [];
  for (const candidate of value.slice(0, MAX_FIELDS)) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const name = boundedString(ownValue(candidate, 'name'));
    const type = ownValue(candidate, 'type');
    if (name.trim().length === 0 || names.has(name) || !FIELD_TYPES.has(type as ConditionBuilderFieldType)) continue;
    names.add(name);
    const label = boundedString(ownValue(candidate, 'label'));
    const placeholder = boundedString(ownValue(candidate, 'placeholder'));
    const options = normalizeOptions(ownValue(candidate, 'options'));
    const operators = normalizeOperators(ownValue(candidate, 'operators'));
    const min = type === 'number'
      ? optionalFiniteNumber(ownValue(candidate, 'min'))
      : type === 'date'
        ? boundedString(ownValue(candidate, 'min')) || undefined
        : undefined;
    const max = type === 'number'
      ? optionalFiniteNumber(ownValue(candidate, 'max'))
      : type === 'date'
        ? boundedString(ownValue(candidate, 'max')) || undefined
        : undefined;
    const step = type === 'number' ? optionalFiniteNumber(ownValue(candidate, 'step'), true) : undefined;
    result.push(Object.freeze({
      name,
      type: type as ConditionBuilderFieldType,
      ...(label ? { label } : {}),
      ...(placeholder ? { placeholder } : {}),
      ...(options.length > 0 ? { options } : {}),
      ...(operators ? { operators } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(step !== undefined ? { step } : {}),
    }));
  }
  return Object.freeze(result);
}

function normalizeConditionValue(value: unknown): ConditionBuilderCondition['value'] {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (!Array.isArray(value)) return undefined;
  return Object.freeze(value
    .slice(0, MAX_OPTIONS)
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => boundedString(entry)));
}

function normalizeConditionBuilderValue(value: unknown): ConditionBuilderValue {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : EMPTY_VALUE;
  const combinator = ownValue(record, 'combinator') === 'or' ? 'or' : 'and';
  const source = ownValue(record, 'conditions');
  const conditions: ConditionBuilderCondition[] = [];
  const ids = new Set<string>();
  if (Array.isArray(source)) {
    for (const candidate of source.slice(0, MAX_CONDITIONS)) {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const id = boundedString(ownValue(candidate, 'id'));
      if (id.trim().length === 0 || ids.has(id)) continue;
      ids.add(id);
      const field = boundedString(ownValue(candidate, 'field'));
      const rawOperator = ownValue(candidate, 'operator');
      const operator = rawOperator === '' || OPERATORS.has(rawOperator as ConditionBuilderOperator)
        ? rawOperator as ConditionBuilderOperator | ''
        : '';
      const normalizedValue = normalizeConditionValue(ownValue(candidate, 'value'));
      conditions.push(Object.freeze({
        id,
        field,
        operator,
        ...(normalizedValue !== undefined ? { value: normalizedValue } : {}),
      }));
    }
  }
  return Object.freeze({ combinator, conditions: Object.freeze(conditions) });
}

/**
 * `<lr-condition-builder>` — a composable structured-condition builder for tabular/dashboard data: a
 * flat list of field/operator/value condition rows combined with one AND/OR combinator.
 *
 * Distinct from this package's `<lr-graph-query-builder>`: that component builds typed
 * relationship/path queries over a knowledge graph, a genuinely different data model from this
 * one's flat tabular field/operator/value conditions — they never share a file or a value type.
 *
 * A host supplies `fields` (the available columns, each with a `ConditionBuilderFieldType` that
 * determines its offered operators and value control) and `value` (a plain
 * `{ combinator, conditions }` object whose valid snapshots can be persisted or sent to a backend,
 * using the same shape convention as this package's `<lr-rubric-form>`/`<lr-filter-bar>`).
 * This component never mutates `fields`/`value` in place — inputs are clone-owned — and never calls
 * out to storage/network itself. It does advance its own copy of `value` on each edit and *then*
 * emits `lr-input` with the complete next state: the same "update, then emit; reassign to control"
 * round-trip `<lr-source-picker>`'s `selectedSourceIds` and `<lr-retrieval-search>`'s `filters`
 * establish. `lr-input` is not cancelable, so a host validating an edit reassigns `value` in its
 * handler rather than vetoing the change before it renders. Controlled condition payloads are
 * preserved when field metadata is absent, changes, or disagrees with an operator/value shape —
 * persisted data is never silently repaired. `validationIssues`, `invalidConditionIds`,
 * `checkValidity()`, and `reportValidity()` expose those disagreements instead. User-entered
 * numeric text is still parsed at the control boundary, where a non-finite result becomes unset.
 * Inputs are clone-owned, bounded readonly snapshots; blank field names, option values, and
 * condition ids are omitted, duplicates use their first valid record, unknown closed-vocabulary
 * values normalize to a safe fallback, and all event details are frozen.
 *
 * **9.0 migration:** this original component was renamed from `<lr-query-builder>` /
 * `LyraQueryBuilder` / `QueryBuilder*` to the condition-specific names above. No legacy tag, class,
 * type, or granular-path alias remains.
 *
 * Each row composes `<lr-select>` for the field and operator pickers, and a value control chosen
 * from the selected field's `type`: `<lr-input type="text">` (`string`), `<lr-input
 * type="number">` (`number`), `<lr-select>` with `True`/`False` options (`boolean`),
 * `<lr-date-input>` (`date`), `<lr-select>` (`enum`, `eq`/`neq`) or a multi-select
 * `<lr-combobox>` (`enum`, `in`/`notIn`). Date fields forward bounded `min`/`max` strings to
 * `<lr-date-input>`; number fields forward finite `min`/`max` and positive finite `step` values to
 * `<lr-input>`. A unary operator (`isEmpty`/`isNotEmpty`) renders no value control.
 * `<lr-icon-button icon="trash">` removes a row; `<lr-button>` appends one.
 *
 * This is a composite query-definition control, not a single submittable form field — it
 * deliberately ships no `label`/`hint`/`errorText` chrome or native form association (the
 * `label`/`hint`/`error` triad those controls share doesn't fit a multi-row, multi-field
 * composite the way it fits one value). A host names the whole control via a plain `aria-label`
 * attribute, applied to the element that owns `role="group"`. The group and each condition expose
 * explicit `aria-invalid="true"|"false"` from the live validation result.
 *
 * @customElement lr-condition-builder
 * @event lr-input - `detail: { value }` — the full current value, after any user-driven change.
 * @event lr-add-condition - Frozen `detail: { condition }` — a row seeded with the first field was appended.
 * @event lr-remove-condition - `detail: { conditionId }` — a row was removed.
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
 * @status stable
 * @since 9.0.0
 */
export class LyraConditionBuilder extends LyraElement<LyraConditionBuilderEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    queryBuilderAddCondition: LYRA_DEFAULT_queryBuilderAddCondition,
    queryBuilderBooleanFalse: LYRA_DEFAULT_queryBuilderBooleanFalse,
    queryBuilderBooleanTrue: LYRA_DEFAULT_queryBuilderBooleanTrue,
    queryBuilderCombinatorAnd: LYRA_DEFAULT_queryBuilderCombinatorAnd,
    queryBuilderCombinatorLabel: LYRA_DEFAULT_queryBuilderCombinatorLabel,
    queryBuilderCombinatorOr: LYRA_DEFAULT_queryBuilderCombinatorOr,
    queryBuilderEmpty: LYRA_DEFAULT_queryBuilderEmpty,
    queryBuilderFieldLabel: LYRA_DEFAULT_queryBuilderFieldLabel,
    queryBuilderFieldPlaceholder: LYRA_DEFAULT_queryBuilderFieldPlaceholder,
    queryBuilderLabel: LYRA_DEFAULT_queryBuilderLabel,
    queryBuilderNoFields: LYRA_DEFAULT_queryBuilderNoFields,
    queryBuilderOperatorAfter: LYRA_DEFAULT_queryBuilderOperatorAfter,
    queryBuilderOperatorBefore: LYRA_DEFAULT_queryBuilderOperatorBefore,
    queryBuilderOperatorContains: LYRA_DEFAULT_queryBuilderOperatorContains,
    queryBuilderOperatorEndsWith: LYRA_DEFAULT_queryBuilderOperatorEndsWith,
    queryBuilderOperatorEquals: LYRA_DEFAULT_queryBuilderOperatorEquals,
    queryBuilderOperatorGreaterThan: LYRA_DEFAULT_queryBuilderOperatorGreaterThan,
    queryBuilderOperatorGreaterThanOrEqual: LYRA_DEFAULT_queryBuilderOperatorGreaterThanOrEqual,
    queryBuilderOperatorIn: LYRA_DEFAULT_queryBuilderOperatorIn,
    queryBuilderOperatorIsEmpty: LYRA_DEFAULT_queryBuilderOperatorIsEmpty,
    queryBuilderOperatorIsNotEmpty: LYRA_DEFAULT_queryBuilderOperatorIsNotEmpty,
    queryBuilderOperatorLabel: LYRA_DEFAULT_queryBuilderOperatorLabel,
    queryBuilderOperatorLessThan: LYRA_DEFAULT_queryBuilderOperatorLessThan,
    queryBuilderOperatorLessThanOrEqual: LYRA_DEFAULT_queryBuilderOperatorLessThanOrEqual,
    queryBuilderOperatorNotEquals: LYRA_DEFAULT_queryBuilderOperatorNotEquals,
    queryBuilderOperatorNotIn: LYRA_DEFAULT_queryBuilderOperatorNotIn,
    queryBuilderOperatorOnOrAfter: LYRA_DEFAULT_queryBuilderOperatorOnOrAfter,
    queryBuilderOperatorOnOrBefore: LYRA_DEFAULT_queryBuilderOperatorOnOrBefore,
    queryBuilderOperatorPlaceholder: LYRA_DEFAULT_queryBuilderOperatorPlaceholder,
    queryBuilderOperatorStartsWith: LYRA_DEFAULT_queryBuilderOperatorStartsWith,
    queryBuilderRemoveCondition: LYRA_DEFAULT_queryBuilderRemoveCondition,
    queryBuilderValueLabel: LYRA_DEFAULT_queryBuilderValueLabel,
    queryBuilderValuePlaceholder: LYRA_DEFAULT_queryBuilderValuePlaceholder,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-input',
    'lr-add-condition',
  ]);

  static override properties = {
    fields: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _fields: readonly ConditionBuilderField[] = EMPTY_FIELDS;
  private _value: ConditionBuilderValue = EMPTY_VALUE;
  private _disabled = false;
  // Set right before a condition row is removed when focus was inside that row -- consumed by
  // updated() to move focus to the add-button, so removing the focused row's remove-button
  // doesn't silently drop focus to the document body.
  private pendingFocusAdd = false;

  /** Frozen snapshot of at most 200 fields, 500 options/operators per field, bounded strings, and
   * finite type-specific number constraints. Reassign after changing it. */
  get fields(): readonly ConditionBuilderField[] {
    return this._fields;
  }
  set fields(next: readonly ConditionBuilderField[]) {
    const old = this._fields;
    this._fields = normalizeFields(next);
    this.requestUpdate('fields', old);
  }

  /** The current query: one combinator plus a flat list of conditions. Controlled — assigning
   *  this directly never emits `lr-input` (that only fires for a user-driven change); see the
   *  class doc's form-association note for why this stays a plain property, not a form value.
   *  Assignment preserves retained operator/value payloads even when they disagree with the current
   *  field metadata; inspect `validationIssues` rather than expecting silent repair. It freezes at
   *  most 200 conditions and 500 entries in each array-valued condition; reassign to update. */
  get value(): ConditionBuilderValue {
    return this._value;
  }
  set value(next: ConditionBuilderValue) {
    const old = this._value;
    this._value = normalizeConditionBuilderValue(next);
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

  private operatorsFor(field: ConditionBuilderField | undefined): readonly ConditionBuilderOperator[] {
    if (!field) return [];
    return field.operators && field.operators.length > 0 ? field.operators : defaultOperatorsForType(field.type);
  }

  private validationIssueFor(condition: ConditionBuilderCondition): ConditionBuilderValidationIssueCode | undefined {
    if (condition.field === '' && condition.operator === '' && condition.value === undefined) return undefined;
    const field = this._fields.find((candidate) => candidate.name === condition.field);
    if (!field) return 'field-unavailable';
    if (condition.operator === '') return condition.value === undefined ? undefined : 'operator-arity';
    if (!this.operatorsFor(field).includes(condition.operator)) return 'operator-not-allowed';

    if (isUnaryOperator(condition.operator)) {
      return condition.value === undefined ? undefined : 'operator-arity';
    }
    if (isMultiOperator(condition.operator)) {
      return Array.isArray(condition.value) ? undefined : 'operator-arity';
    }
    if (Array.isArray(condition.value)) return 'operator-arity';
    if (condition.value === undefined) return undefined;

    switch (field.type) {
      case 'number':
        return typeof condition.value === 'number' && Number.isFinite(condition.value)
          ? undefined
          : 'value-type';
      case 'boolean':
        return typeof condition.value === 'boolean' ? undefined : 'value-type';
      case 'string':
      case 'date':
      case 'enum':
        return typeof condition.value === 'string' ? undefined : 'value-type';
    }
  }

  /** Live, frozen validation results for controlled conditions that disagree with the current
   * field/operator/arity/type vocabulary. Reading this never mutates `value`. */
  get validationIssues(): readonly ConditionBuilderValidationIssue[] {
    const issues: ConditionBuilderValidationIssue[] = [];
    for (const condition of this._value.conditions) {
      const code = this.validationIssueFor(condition);
      if (code) issues.push(Object.freeze({ conditionId: condition.id, code }));
    }
    return Object.freeze(issues);
  }

  /** Condition ids currently represented in `validationIssues`, in model order. */
  get invalidConditionIds(): readonly string[] {
    return Object.freeze(this.validationIssues.map((issue) => issue.conditionId));
  }

  /** Whether every retained controlled condition agrees with the current field metadata. */
  checkValidity(): boolean {
    return this.validationIssues.length === 0;
  }

  /** Reports current validity without rewriting controlled data. When invalid, focuses the first
   * affected field/operator/value control so a caller's Apply action has a useful recovery target. */
  reportValidity(): boolean {
    const issue = this.validationIssues[0];
    if (!issue) return true;
    const row = this.conditionElement(issue.conditionId);
    const part = issue.code === 'field-unavailable'
      ? 'field-select'
      : issue.code === 'operator-not-allowed'
        ? 'operator-select'
        : 'value';
    let target = row?.querySelector<HTMLElement>(`[part="${part}"]`) ?? null;
    if (!target || target.matches('span')) {
      target = row?.querySelector<HTMLElement>('[part="operator-select"]') ?? null;
    }
    target?.focus();
    return false;
  }

  private operatorLabel(op: ConditionBuilderOperator, type: ConditionBuilderFieldType | undefined): string {
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
  private defaultValueFor(fieldName: string, operator: ConditionBuilderOperator | ''): ConditionBuilderCondition['value'] {
    if (operator === '' || isUnaryOperator(operator)) return undefined;
    if (isMultiOperator(operator)) return [];
    const field = this._fields.find((f) => f.name === fieldName);
    if (field?.type === 'number' || field?.type === 'boolean') return undefined;
    return '';
  }

  private commit(next: ConditionBuilderValue): void {
    this.value = next;
    this.emit('lr-input', Object.freeze({ value: this._value }));
  }

  /** Appends a new condition seeded with the first available field, or does nothing when no field
   *  exists. The operator remains empty until the user chooses the intended comparison. */
  addCondition(): void {
    const firstField = this._fields[0];
    if (this.disabled || !firstField || this._value.conditions.length >= MAX_CONDITIONS) return;
    const condition: ConditionBuilderCondition = Object.freeze({
      id: nextId('query-condition'),
      field: firstField.name,
      operator: '',
    });
    this.commit({ ...this._value, conditions: [...this._value.conditions, condition] });
    this.emit('lr-add-condition', Object.freeze({ condition }));
  }

  private conditionElement(id: string): HTMLElement | null {
    const root = this.shadowRoot;
    if (!root) return null;
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    if (typeof ownerCss?.escape === 'function') {
      try {
        const candidate = root.querySelector<HTMLElement>(
          `[part="condition"][data-id="${ownerCss.escape(id)}"]`,
        );
        if (candidate?.getAttribute('data-id') === id) return candidate;
      } catch {
        // A partial DOM can expose CSS.escape while rejecting selector construction.
      }
    }
    return (
      Array.from(root.querySelectorAll<HTMLElement>('[part="condition"][data-id]')).find(
        (candidate) => candidate.getAttribute('data-id') === id,
      ) ?? null
    );
  }

  /** Removes the condition row with the given `id`, if present. */
  removeCondition(id: string): void {
    if (this.disabled) return;
    if (!this._value.conditions.some((c) => c.id === id)) return;
    const row = this.conditionElement(id);
    const active = activeElementIn(this.shadowRoot);
    if (row && active && row.contains(active)) this.pendingFocusAdd = true;
    const conditions = this._value.conditions.filter((c) => c.id !== id);
    this.commit({ ...this._value, conditions });
    this.emit('lr-remove-condition', Object.freeze({ conditionId: id }));
  }

  private setCombinator(combinator: ConditionBuilderCombinator): void {
    if (this.disabled || combinator === this._value.combinator) return;
    this.commit({ ...this._value, combinator });
  }

  private setConditionField(id: string, field: string): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) => (c.id === id ? { id: c.id, field, operator: '' as const, value: undefined } : c));
    this.commit({ ...this._value, conditions });
  }

  private setConditionOperator(id: string, operator: ConditionBuilderOperator | ''): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) =>
      c.id === id ? { ...c, operator, value: this.defaultValueFor(c.field, operator) } : c,
    );
    this.commit({ ...this._value, conditions });
  }

  private setConditionValue(id: string, value: ConditionBuilderCondition['value']): void {
    if (this.disabled) return;
    const conditions = this._value.conditions.map((c) => (c.id === id ? { ...c, value } : c));
    this.commit({ ...this._value, conditions });
  }

  private consumeChildEvent(event: Event, action: () => void): void {
    event.stopPropagation();
    action();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.pendingFocusAdd) {
      this.pendingFocusAdd = false;
      (this.renderRoot.querySelector('[part="add-button"]') as (HTMLElement & { focus(): void }) | null)?.focus();
    }
  }

  private renderCombinator(combinator: ConditionBuilderCombinator): TemplateResult {
    return html`
      <lr-select
        part="combinator"
        size="s"
        aria-label=${this.localize('queryBuilderCombinatorLabel')}
        .value=${combinator}
        ?disabled=${this.disabled}
        @change=${(event: Event) =>
          this.consumeChildEvent(event, () =>
            this.setCombinator((event.target as LyraSelect).value as ConditionBuilderCombinator),
          )}
      >
        <lr-option value="and">${this.localize('queryBuilderCombinatorAnd')}</lr-option>
        <lr-option value="or">${this.localize('queryBuilderCombinatorOr')}</lr-option>
      </lr-select>
    `;
  }

  private renderValueControl(condition: ConditionBuilderCondition, field: ConditionBuilderField | undefined): TemplateResult {
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
          .min=${typeof field.min === 'string' ? field.min : ''}
          .max=${typeof field.max === 'string' ? field.max : ''}
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
          .min=${typeof field.min === 'number' ? field.min : undefined}
          .max=${typeof field.max === 'number' ? field.max : undefined}
          .step=${field.step}
          ?disabled=${this.disabled}
          @lr-input=${(event: Event) =>
            this.consumeChildEvent(event, () => {
              const raw = (event.target as LyraInput).value;
              const parsed = raw === '' ? undefined : Number(raw);
              this.setConditionValue(
                condition.id,
                parsed !== undefined && !Number.isFinite(parsed) ? undefined : parsed,
              );
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
        @lr-input=${(event: Event) =>
          this.consumeChildEvent(event, () =>
            this.setConditionValue(condition.id, (event.target as LyraInput).value),
          )}
      ></lr-input>
    `;
  }

  private renderCondition(
    condition: ConditionBuilderCondition,
    index: number,
    validationCode: ConditionBuilderValidationIssueCode | undefined,
  ): TemplateResult {
    const field = this._fields.find((f) => f.name === condition.field);
    const operators = this.operatorsFor(field);
    return html`
      <div
        part="condition"
        role="listitem"
        data-id=${condition.id}
        data-validation-code=${validationCode ?? nothing}
        aria-invalid=${validationCode ? 'true' : 'false'}
      >
        <lr-select
          part="field-select"
          size="s"
          aria-label=${this.localize('queryBuilderFieldLabel')}
          placeholder=${this.localize('queryBuilderFieldPlaceholder')}
          .value=${condition.field}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.consumeChildEvent(event, () =>
              this.setConditionField(condition.id, selectValue(event.target as LyraSelect)),
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
              this.setConditionOperator(condition.id, (event.target as LyraSelect).value as ConditionBuilderOperator),
            )}
        >
          ${operators.map((op) => html`<lr-option value=${op}>${this.operatorLabel(op, field?.type)}</lr-option>`)}
        </lr-select>

        ${this.renderValueControl(condition, field)}

        <lr-icon-button
          part="remove-button"
          icon="trash"
          aria-label=${this.localize('queryBuilderRemoveCondition', undefined, { index: this.formatCount(index + 1) })}
          ?disabled=${this.disabled}
          @click=${(event: Event) => this.consumeChildEvent(event, () => this.removeCondition(condition.id))}
        ></lr-icon-button>
      </div>
    `;
  }

  override render(): TemplateResult {
    const hasFields = this._fields.length > 0;
    const value = this._value;
    const validationIssues = this.validationIssues;
    const issueById = new Map(validationIssues.map((issue) => [issue.conditionId, issue.code]));
    return html`
      <div
        part="base"
        role="group"
        aria-label=${hostAriaLabel(this) ?? this.localize('queryBuilderLabel')}
        aria-invalid=${validationIssues.length > 0 ? 'true' : 'false'}
      >
        ${!hasFields
          ? html`<p part="empty">${this.localize('queryBuilderNoFields')}</p>`
          : html`
              ${value.conditions.length > 1 ? this.renderCombinator(value.combinator) : nothing}
              ${value.conditions.length === 0
                ? html`<p part="empty">${this.localize('queryBuilderEmpty')}</p>`
                : html`
                    <div part="conditions" role="list">
                      ${value.conditions.map((condition, index) =>
                        this.renderCondition(condition, index, issueById.get(condition.id)))}
                    </div>
                  `}
              <lr-button
                part="add-button"
                appearance="outlined"
                size="s"
                ?disabled=${this.disabled}
                @click=${(event: Event) => this.consumeChildEvent(event, () => this.addCondition())}
              >
                ${this.localize('queryBuilderAddCondition')}
              </lr-button>
            `}
      </div>
    `;
  }
  /** `localize()` interpolates with a bare `String(value)`, so a number handed to it renders in
   *  ASCII digits no matter the locale -- mixing two numbering systems inside one translated
   *  sentence. Route every user-facing number through the effective locale instead. */
  private formatCount(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-condition-builder': LyraConditionBuilder;
  }

}
