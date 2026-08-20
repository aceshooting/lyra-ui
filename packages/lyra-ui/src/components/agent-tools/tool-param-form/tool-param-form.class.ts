import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
// Side-effect only: registers this component's form-control-label support (external-label bridge + form-internals capture) with LyraElement, since the base class no longer imports it unconditionally. See registerFormControlLabelSupport()'s own doc in internal/lyra-element.ts.
import '../../../internal/form-control-labels.js';
import { nextId } from '../../../internal/a11y.js';
import {
  AnchoredValidityController,
  resolveValidityAnchor,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import { syncValidityStates } from '../../../internal/custom-states.js';
import { styles } from './tool-param-form.styles.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import '../../forms/select/select.class.js';
import '../../forms/combobox/option.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldMustBeBoolean, LYRA_DEFAULT_fieldMustBeInteger, LYRA_DEFAULT_fieldMustBeNumber, LYRA_DEFAULT_fieldMustBeOneOf, LYRA_DEFAULT_fieldMustBeString, LYRA_DEFAULT_fieldMustEqual, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_noData, LYRA_DEFAULT_schemaMustBeObject, LYRA_DEFAULT_schemaPropertiesMustBeFlat, LYRA_DEFAULT_toolParamBooleanFalse, LYRA_DEFAULT_toolParamBooleanTrue, LYRA_DEFAULT_toolParamBooleanUnset, LYRA_DEFAULT_toolParamMissingProperty, LYRA_DEFAULT_toolParamSchemaLimit, LYRA_DEFAULT_unsupportedFieldType, LYRA_DEFAULT_valueMustBeSerializable } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The four leaf property types this flat-schema renderer understands. */
export type ToolParamFormPropertyType = 'string' | 'number' | 'integer' | 'boolean';
export type ToolParamFormPrimitive = string | number | boolean;

/**
 * One `schema.properties` entry. Deliberately shallow — see the class doc for
 * the full scope limitation this type encodes.
 */
export interface ToolParamFormProperty {
  readonly type: ToolParamFormPropertyType;
  /** A closed set of string choices, rendered as a `<lr-select>`. Only meaningful when `type` is `'string'`. */
  readonly enum?: readonly string[];
  /** Helper text rendered under the field. */
  readonly description?: string;
  /** Display label. Falls back to the property key itself when omitted. */
  readonly title?: string;
  /** Pre-filled value used whenever `value` doesn't already have this key. */
  readonly default?: unknown;
  /** Exact primitive value required when the property is present. */
  readonly const?: ToolParamFormPrimitive;
  /** Native editing-assistance hints forwarded when this property renders a text input. */
  readonly autocomplete?: string;
  readonly spellcheck?: boolean;
  readonly autocapitalize?: string;
  readonly autoCorrect?: string;
  readonly inputMode?: string;
  readonly enterKeyHint?: string;
}

/**
 * The (intentionally flat) JSON Schema subset this component can render:
 * a plain object whose every property is a string, number/integer, boolean,
 * or string enum. See the class doc for what's out of scope.
 */
export interface FlatToolParamSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, ToolParamFormProperty>>;
  readonly required?: readonly string[];
}

const MAX_SCHEMA_FIELDS = 100;
const MAX_ENUM_OPTIONS = 500;
const MAX_VALUE_ENTRIES = 10_000;
const MAX_VALUE_NODES = 50_000;
const MAX_VALUE_DEPTH = 16;
const OMIT_VALUE = Symbol('omit-tool-param-value');

export type ToolParamFormValue = Readonly<Record<string, unknown>>;

interface SnapshotBudget {
  remaining: number;
  readonly seen: WeakMap<object, unknown>;
  invalid: boolean;
  truncated: boolean;
}

function isPlainRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function snapshotValueEntry(
  value: unknown,
  budget: SnapshotBudget,
  depth: number,
): unknown | typeof OMIT_VALUE {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (typeof value === 'function') return value;
  if (depth > MAX_VALUE_DEPTH || budget.remaining <= 0) {
    budget.truncated = true;
    return OMIT_VALUE;
  }
  const existing = budget.seen.get(value);
  if (existing !== undefined) return existing;

  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    budget.invalid = true;
    return OMIT_VALUE;
  }
  if (isArray) {
    const output: unknown[] = [];
    budget.seen.set(value, output);
    let length = 0;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (
        descriptor &&
        'value' in descriptor &&
        typeof descriptor.value === 'number' &&
        Number.isSafeInteger(descriptor.value) &&
        descriptor.value >= 0
      ) {
        if (descriptor.value > MAX_VALUE_ENTRIES) budget.truncated = true;
        length = Math.min(descriptor.value, MAX_VALUE_ENTRIES);
      }
    } catch {
      budget.invalid = true;
    }
    for (let index = 0; index < length && budget.remaining > 0; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        budget.invalid = true;
        continue;
      }
      if (!descriptor) continue;
      if (!('value' in descriptor)) {
        budget.invalid = true;
        continue;
      }
      budget.remaining -= 1;
      const entry = snapshotValueEntry(descriptor.value, budget, depth + 1);
      if (entry !== OMIT_VALUE) output.push(entry);
    }
    if (budget.remaining <= 0 && length > output.length) budget.truncated = true;
    return Object.freeze(output);
  }

  if (!isPlainRecord(value)) return value;
  const output: Record<PropertyKey, unknown> = {};
  budget.seen.set(value, output);
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    budget.invalid = true;
    return OMIT_VALUE;
  }
  let retained = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as keyof PropertyDescriptorMap];
    if (!descriptor?.enumerable) continue;
    if (retained >= MAX_VALUE_ENTRIES || budget.remaining <= 0) {
      budget.truncated = true;
      break;
    }
    if (!('value' in descriptor)) {
      budget.invalid = true;
      continue;
    }
    retained += 1;
    budget.remaining -= 1;
    const entry = snapshotValueEntry(descriptor.value, budget, depth + 1);
    if (entry !== OMIT_VALUE) {
      Object.defineProperty(output, key, {
        value: entry,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
  return Object.freeze(output);
}

function snapshotFormValue(value: unknown): {
  readonly value: ToolParamFormValue;
  readonly invalid: boolean;
  readonly truncated: boolean;
} {
  if (value == null) return { value: Object.freeze({}), invalid: false, truncated: false };
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { value: Object.freeze({}), invalid: true, truncated: false };
  }
  if (typeof value !== 'object' || isArray || !isPlainRecord(value)) {
    return { value: Object.freeze({}), invalid: true, truncated: false };
  }
  const budget: SnapshotBudget = {
    remaining: MAX_VALUE_NODES,
    seen: new WeakMap(),
    invalid: false,
    truncated: false,
  };
  const snapshot = snapshotValueEntry(value, budget, 0);
  return {
    value: snapshot === OMIT_VALUE ? Object.freeze({}) : snapshot as ToolParamFormValue,
    invalid: budget.invalid || snapshot === OMIT_VALUE,
    truncated: budget.truncated,
  };
}

interface SchemaSnapshot {
  readonly schema: FlatToolParamSchema;
  readonly shapeError: 'object' | 'properties' | '';
  readonly exceededLimits: boolean;
}

const EMPTY_SCHEMA: FlatToolParamSchema = Object.freeze({
  type: 'object',
  properties: Object.freeze({}),
});

function snapshotSchemaStringArray(value: unknown): {
  readonly value?: readonly string[];
  readonly isArray: boolean;
  readonly exceededLimit: boolean;
} {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { isArray: false, exceededLimit: false };
  }
  if (!isArray) return { isArray: false, exceededLimit: false };

  let sourceLength = 0;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      descriptor &&
      'value' in descriptor &&
      typeof descriptor.value === 'number' &&
      Number.isSafeInteger(descriptor.value) &&
      descriptor.value >= 0
    ) {
      sourceLength = descriptor.value;
    }
  } catch {
    return { isArray: true, value: Object.freeze([]), exceededLimit: false };
  }

  const output: string[] = [];
  for (let index = 0; index < Math.min(sourceLength, MAX_SCHEMA_FIELDS); index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      continue;
    }
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') {
      output.push(descriptor.value);
    }
  }
  return {
    isArray: true,
    value: Object.freeze(output),
    exceededLimit: sourceLength > MAX_SCHEMA_FIELDS,
  };
}

function snapshotSchema(value: unknown): SchemaSnapshot {
  if (value == null) return { schema: EMPTY_SCHEMA, shapeError: '', exceededLimits: false };
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { schema: EMPTY_SCHEMA, shapeError: 'object', exceededLimits: false };
  }
  if (typeof value !== 'object' || isArray) {
    return { schema: EMPTY_SCHEMA, shapeError: 'object', exceededLimits: false };
  }
  let rootDescriptors: PropertyDescriptorMap;
  try {
    rootDescriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return { schema: EMPTY_SCHEMA, shapeError: 'object', exceededLimits: false };
  }
  const typeDescriptor = rootDescriptors['type'];
  if (!typeDescriptor || !('value' in typeDescriptor) || typeDescriptor.value !== 'object') {
    return { schema: EMPTY_SCHEMA, shapeError: 'object', exceededLimits: false };
  }
  const propertiesDescriptor = rootDescriptors['properties'];
  const propertiesValue = propertiesDescriptor && 'value' in propertiesDescriptor
    ? propertiesDescriptor.value
    : undefined;
  if (
    propertiesValue === null ||
    typeof propertiesValue !== 'object' ||
    !isPlainRecord(propertiesValue)
  ) {
    return { schema: EMPTY_SCHEMA, shapeError: 'properties', exceededLimits: false };
  }

  const properties: Record<string, ToolParamFormProperty> = Object.create(null);
  let shapeError: SchemaSnapshot['shapeError'] = '';
  let exceededLimits = false;
  let seenFields = 0;
  let propertyDescriptors: PropertyDescriptorMap;
  try {
    propertyDescriptors = Object.getOwnPropertyDescriptors(propertiesValue);
  } catch {
    return { schema: EMPTY_SCHEMA, shapeError: 'properties', exceededLimits: false };
  }
  for (const key of Reflect.ownKeys(propertyDescriptors)) {
    const descriptor = propertyDescriptors[key as keyof PropertyDescriptorMap];
    if (typeof key !== 'string' || !descriptor?.enumerable) continue;
    seenFields += 1;
    if (seenFields > MAX_SCHEMA_FIELDS) {
      exceededLimits = true;
      break;
    }
    if (
      !('value' in descriptor) ||
      descriptor.value === null ||
      typeof descriptor.value !== 'object' ||
      !isPlainRecord(descriptor.value)
    ) {
      shapeError = 'properties';
      continue;
    }
    const propertySnapshot = snapshotFormValue(descriptor.value);
    if (propertySnapshot.invalid || propertySnapshot.truncated) {
      shapeError = 'properties';
      continue;
    }
    const property = propertySnapshot.value as unknown as ToolParamFormProperty;
    let choices = property.enum;
    if (Array.isArray(choices) && choices.length > MAX_ENUM_OPTIONS) {
      exceededLimits = true;
      choices = Object.freeze(choices.slice(0, MAX_ENUM_OPTIONS));
    }
    properties[key] = Object.freeze({
      ...property,
      ...(choices === undefined ? {} : { enum: choices }),
    });
  }

  const requiredDescriptor = rootDescriptors['required'];
  let required: readonly string[] | undefined;
  if (requiredDescriptor && 'value' in requiredDescriptor) {
    const requiredSnapshot = snapshotSchemaStringArray(requiredDescriptor.value);
    if (requiredSnapshot.isArray) {
      required = requiredSnapshot.value;
      if (requiredSnapshot.exceededLimit) exceededLimits = true;
    } else if (requiredDescriptor.enumerable) {
      shapeError = 'properties';
    }
  } else if (requiredDescriptor?.enumerable) {
    shapeError = 'properties';
  }

  return {
    schema: Object.freeze({
      type: 'object',
      properties: Object.freeze(properties),
      ...(required === undefined ? {} : { required }),
    }),
    shapeError,
    exceededLimits,
  };
}

function cloneFormValue(
  value: ToolParamFormValue,
  _ownerWindow: Window | null,
): ToolParamFormValue {
  return snapshotFormValue(value).value;
}

export interface LyraToolParamFormEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-validity-change': CustomEvent<LyraEventDetailSnapshot<{
    readonly valid: boolean;
    readonly errors: Readonly<Record<string, string>>;
  }>>;
  'lr-input': CustomEvent<LyraEventDetailSnapshot<{ readonly value: ToolParamFormValue }>>;
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
}
/**
 * `<lr-tool-param-form>` — renders one form control per top-level property
 * of a JSON Schema object, for ad hoc tool invocation or approval-editing UIs
 * (e.g. "the agent wants to call `create_event(title, attendees, allDay)` —
 * let the user tweak the arguments before running it").
 *
 * **Scope limitation (intentional, not accidental):** this renderer only
 * understands a *flat* object schema — every `properties` entry must be
 * `'string'`, `'number'`, `'integer'`, `'boolean'`, or a string `enum`;
 * primitive `const` is also enforced. Nested objects, arrays,
 * `oneOf`/`anyOf`/`allOf`, `$ref`, constraints such as `minLength`/`minimum`,
 * and schema-valued `additionalProperties` are not read. A full
 * JSON-Schema-to-form renderer is
 * out of scope for this component; a property whose `type` isn't one of the
 * four above renders a visible "Unsupported field type" note and marks the
 * form invalid instead of silently dropping it or throwing.
 * A schema is additionally bounded to 100 fields and 500 enum choices per field. Exceeding either
 * ceiling fails the form closed with a localized form-wide error while the bounded prefix remains
 * available for inspection; malformed null/array property definitions fail as schema errors rather
 * than being misreported as value-serialization failures.
 *
 * Fields render in `Object.keys(schema.properties)` order (insertion order,
 * which is reliable for a plain object's string keys). A field's label is
 * `title ?? ` the property key; `description` renders as helper text below
 * the control; a key listed in `required` gets a visible `*`. The outer component owns validation
 * because JSON Schema `required` means property presence, unlike HTML controls' nonempty/must-check
 * semantics. Boolean fields therefore expose explicit unset/true/false values instead of
 * conflating an absent property with `false`.
 *
 * Deliberately no top-level `label`/`hint`/`errorText` chrome (unlike
 * `<lr-checkbox-group>`'s own trio, despite both being compound, multi-item
 * form controls): every field already carries its own per-field
 * `label`/`description`/`error` parts above, and this whole control is
 * meant to be composed inside a consumer's own dialog/section (e.g. "Approve
 * `create_event` call?") that already supplies the surrounding heading and
 * context — a second, redundant outer label here would just repeat it. A
 * form-wide validation summary is still available via the `error` part
 * (`class="form-error"`), driven by `reportValidity()`.
 * The `base` wrapper is always the accessible `role="group"`, so a native external `<label for>`
 * pointing at this form-associated host can name it via the external-label bridge. A host
 * `aria-label` wins by attribute presence (including an explicitly empty value), forwarded onto
 * that same `base` wrapper — matching `<lr-rubric-form>`'s identical pattern. Every generated field
 * retains its own more specific name either way.
 *
 * This component owns no Submit/Cancel/Approve chrome — a consumer composes
 * it inside their own dialog (e.g. a tool-approval dialog) and reads
 * `.value`/`.errors`/`checkValidity()` (or calls `reportValidity()` right
 * before acting, which also reveals any inline errors that user interaction
 * hasn't surfaced yet).
 *
 * `value` is exactly what the consumer last set it to — a field with no
 * entry in `value` but a schema `default` displays (and is *emitted*, via
 * `lr-input`) as that default, but the `value` *property* itself is left
 * alone until the user actually edits that field. This mirrors an
 * uncontrolled `<input placeholder>` not writing to `.value`, and means the
 * very first `lr-input` a consumer receives already carries every default
 * resolved, so round-tripping `e.detail.value` back into `.value` converges
 * after one edit. JSON Schema defines `default` as an annotation; this form
 * renderer deliberately materializes it before validation and submission,
 * so a valid default can satisfy `required` here.
 *
 * Optional native `<form>` participation is implemented via `ElementInternals`
 * attached directly (this component's value is a whole object, not a plain
 * string, so the `FormAssociated` string-value mixin doesn't fit — same
 * shape as `<lr-combobox>`'s array-valued case). This is a nice-to-have
 * layered on top of the primary integration contract (`value` +
 * `lr-input`/`lr-validity-change`), not a requirement: a consumer that
 * never puts this inside a `<form>` loses nothing.
 * The value present on first connection is cloned as the native default.
 * `form.reset()` restores a fresh clone of that default, clears touched and
 * interaction state, and preserves any consumer-set custom validity message,
 * matching native controls' separation between reset state and custom errors.
 *
 * @customElement lr-tool-param-form
 * @event lr-input - A field's value changed. `detail: { value }` — the
 * full current value object (every property, defaults resolved), not just
 * the field that changed.
 * @event lr-validity-change - Effective native validity or errors changed. The frozen
 * `detail: { valid, errors }` includes custom errors and own/fieldset validation barring.
 * @event focus - Re-dispatched when a generated native text/number input receives focus. Composed
 * controls (`<lr-select>`) already expose their own bubbling, composed bridge.
 * @event blur - Re-dispatched when a generated native text/number input loses focus.
 * @event lr-invalid - The complete parameter form failed a validity check. Cancelable;
 * preventing it also prevents the native `invalid` event's default validation UI.
 * @csspart base - The outer wrapper around all fields.
 * @csspart field - One property's wrapper (label + control + description + error).
 * @csspart label - A field's label.
 * @csspart control - The native `<input>` for a `'string'` (non-enum) or `'number'`/`'integer'`
 * field. Shared part on both the text and number inputs; not present on the `'boolean'`/enum
 * (`<lr-select>`) or unsupported-type fallback branches.
 * @csspart description - A field's helper text, from `schema.description`.
 * @csspart error - A field-level or form-level validation message.
 * @csspart unsupported - The fallback note rendered in place of a control for
 * a property whose `type` is outside this renderer's scope.
 * @csspart empty - The message shown when `schema.properties` has no entries.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * `label` part of every field whose key is listed in the schema's `required` array — per field
 * here, not per host, because this control's value is a whole object. Set it to `''` to suppress
 * the marker, or to any other quoted string (`' (required)'`, a localized word) to replace it.
 * Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssprop [--lr-tool-param-form-invalid-border-color=var(--lr-color-danger)] - Border color of
 * an invalid generated native text or number input.
 * @cssstate required - The schema declares at least one required property. Requiredness is
 * per-property here (the value is an object), so this is the whole-control reading: "this form
 * demands something of the user".
 * @cssstate optional - The schema declares no required property.
 * @cssstate valid - Every field currently satisfies the supported schema subset, whether or not the
 * user has touched anything.
 * @cssstate invalid - At least one field, or the schema shape itself, is currently in error.
 * @cssstate user-valid - `valid`, and the user has interacted (edited a field, left one, or a
 * `reportValidity()` call — which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid`, and the user has interacted. A pristine required field is
 * invalid but deliberately does not match this, so a consumer's `:state(user-invalid)` styling
 * cannot paint the form red before the user has typed anything. A form reset makes it pristine
 * again.
 * @status stable
 * @since 4.0.0
 */
export class LyraToolParamForm extends LyraElement<LyraToolParamFormEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldMustBeBoolean: LYRA_DEFAULT_fieldMustBeBoolean,
    fieldMustBeInteger: LYRA_DEFAULT_fieldMustBeInteger,
    fieldMustBeNumber: LYRA_DEFAULT_fieldMustBeNumber,
    fieldMustBeOneOf: LYRA_DEFAULT_fieldMustBeOneOf,
    fieldMustBeString: LYRA_DEFAULT_fieldMustBeString,
    fieldMustEqual: LYRA_DEFAULT_fieldMustEqual,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    noData: LYRA_DEFAULT_noData,
    schemaMustBeObject: LYRA_DEFAULT_schemaMustBeObject,
    schemaPropertiesMustBeFlat: LYRA_DEFAULT_schemaPropertiesMustBeFlat,
    toolParamBooleanFalse: LYRA_DEFAULT_toolParamBooleanFalse,
    toolParamBooleanTrue: LYRA_DEFAULT_toolParamBooleanTrue,
    toolParamBooleanUnset: LYRA_DEFAULT_toolParamBooleanUnset,
    toolParamMissingProperty: LYRA_DEFAULT_toolParamMissingProperty,
    toolParamSchemaLimit: LYRA_DEFAULT_toolParamSchemaLimit,
    unsupportedFieldType: LYRA_DEFAULT_unsupportedFieldType,
    valueMustBeSerializable: LYRA_DEFAULT_valueMustBeSerializable,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-validity-change',
    'lr-input',
  ]);

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    schema: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  // The true (touched-independent) per-field error set, recomputed by the
  // synchronous schema/value accessors so native validity APIs and the next
  // render observe the same state. Exposed publicly (read-only) via the
  // `errors` getter below, under a leading underscore so the getter itself
  // can be named plain `errors` without a collision.
  @state() private _errors: Record<string, string> = {};
  @state() private _formError = '';
  @state() private showFormError = false;
  // Which fields have been visited (focusout'd) at least once — gates only
  // the *visual* error/aria-invalid presentation, matching every other
  // form control in this library (lr-select/lr-combobox/lr-model-select
  // all avoid flashing red before the user has touched anything).
  @state() private touchedFields = new Set<string>();

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private baseId = nextId('tool-param-form');
  private _fieldsetDisabled = false;
  private _name = '';
  private _schema: FlatToolParamSchema = EMPTY_SCHEMA;
  private schemaInputShapeError: SchemaSnapshot['shapeError'] = '';
  private schemaInputExceededLimits = false;
  private _value: ToolParamFormValue = Object.freeze({});
  private valueInputInvalid = false;
  private valueInputTruncated = false;
  private defaultValueSnapshot: ToolParamFormValue = Object.freeze({});
  private defaultValueCaptured = false;
  private _effectiveValue: ToolParamFormValue = Object.freeze({});
  private _validityFlags: ValidityStateFlags = {};
  private _disabled = false;
  // Guards lr-validity-change so it only fires on an actual change, not on
  // every render — `undefined` guarantees the first computed state always
  // "changes" from it, so mounting with an unmet required field still
  // announces `valid:false` once up front.
  private lastValidityKey: string | undefined;
  // Gates the `user-valid`/`user-invalid` custom states only. Deliberately
  // separate from `touchedFields`: that set is per-field and is also filled
  // wholesale by `reportValidity()` *when there are errors*, so a
  // `reportValidity()` that passes would leave it empty and a valid form
  // could never reach `user-valid`. This flag answers the different
  // question "has the user done anything at all here yet".
  private hasInteracted = false;
  private errorAnnouncementSink?: AnnouncementSink;
  private visibleErrorSnapshot = new Map<string, string>();
  private suppressNextErrorAnnouncement = true;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init),
    );
    this.syncFormState();
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the browser-resolved owning form, including an external owner selected by `form`. */
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    const field = this.firstInvalidField();
    if (field) {
      const input = field.querySelector<HTMLElement>('input.control');
      if (input) return input;
      for (const child of field.children) {
        const anchor = resolveValidityAnchor(child);
        if (anchor) return anchor;
      }
    }
    return this.firstMissingPropertyError();
  }

  private firstInvalidField(): HTMLElement | undefined {
    if (!this.renderRoot) return undefined;
    const fields = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[part="field"]'));
    for (const key of Object.keys(this._errors)) {
      const field = fields.find((candidate) => candidate.dataset['key'] === key);
      if (field) return field;
    }
    return undefined;
  }

  private get missingRequiredKeys(): string[] {
    const properties = this.schemaProperties;
    return this.requiredKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(properties, key) && Boolean(this._errors[key]),
    );
  }

  private firstMissingPropertyError(): HTMLElement | undefined {
    if (!this.renderRoot) return undefined;
    const errors = Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>('[part="error"][data-missing-property]'),
    );
    for (const key of Object.keys(this._errors)) {
      const error = errors.find((candidate) => candidate.dataset['key'] === key);
      if (error) return error;
    }
    return undefined;
  }

  private focusFirstControl(): void {
    if (!this.renderRoot) return;
    const controls = this.renderRoot.querySelectorAll<HTMLElement>('input.control, lr-select');
    for (const control of controls) {
      const disabled = (control as HTMLElement & { disabled?: boolean }).disabled
        || control.getAttribute('aria-disabled') === 'true';
      if (!disabled) {
        control.focus();
        return;
      }
    }
  }

  /** Forwards host clicks to the first rendered form field so the component behaves like a regular
   *  control from caller code and event re-dispatch paths.
   */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.focusFirstControl();
  }

  override connectedCallback(): void {
    if (!this.defaultValueCaptured) {
      this.defaultValueSnapshot = cloneFormValue(this._value, this.ownerDocument.defaultView);
      this.defaultValueCaptured = true;
    }
    super.connectedCallback();
    if (this.errorAnnouncementSink?.element.ownerDocument !== this.ownerDocument) {
      this.errorAnnouncementSink?.release();
      this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
        document: this.ownerDocument,
        source: this,
      });
    }
    if (this.hasUpdated) {
      this.suppressNextErrorAnnouncement = true;
      this.requestUpdate();
    }
    // Seed `errors`/`internals` validity synchronously at connect time —
    // `checkValidity()`/a wrapping `<form>`'s own `reportValidity()` must
    // see the correct answer even if called before Lit's first (async)
    // update has run, mirroring lr-select's/lr-checkbox's identical
    // connectedCallback -> updateValidity() call.
    this.syncFormState();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    this.suppressNextErrorAnnouncement = true;
  }

  /** `value`, with any property missing from it filled in from `schema`'s own `default` — see the class doc. */
  get effectiveValue(): ToolParamFormValue {
    return snapshotFormValue(this._effectiveValue).value;
  }

  private get schemaProperties(): Readonly<Record<string, ToolParamFormProperty>> {
    return this._schema.properties;
  }

  private get requiredKeys(): readonly string[] {
    return this._schema.required ?? Object.freeze([]);
  }

  private resolveEffectiveValue(): ToolParamFormValue {
    const props = this.schemaProperties;
    const out: Record<string, unknown> = { ...this.value };
    for (const [key, prop] of Object.entries(props)) {
      // `hasOwnProperty`, not `out[key] === undefined` — a number field the
      // user has explicitly cleared is `{ days: undefined }` (a real own
      // property, via the `{...this.value, [key]: val}` spread in
      // setFieldValue()), and must stay cleared rather than silently
      // snapping back to its default just because its current value also
      // happens to be `undefined`. Only a key genuinely absent from `value`
      // (never touched, or reset back to `{}`) falls back to the default.
      if (!Object.prototype.hasOwnProperty.call(this.value, key) && prop.default !== undefined) {
        Object.defineProperty(out, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: prop.default,
        });
      }
    }
    return snapshotFormValue(out).value;
  }

  /** Detached, deeply frozen schema snapshot. At most 100 fields, 100 required keys, and 500 enum
   * choices per field are retained. Oversized assignments remain invalid until replaced; reassign
   * the schema after changing it. */
  get schema(): FlatToolParamSchema {
    return this._schema;
  }
  set schema(next: FlatToolParamSchema) {
    const old = this._schema;
    const snapshot = snapshotSchema(next);
    this._schema = snapshot.schema;
    this.schemaInputShapeError = snapshot.shapeError;
    this.schemaInputExceededLimits = snapshot.exceededLimits;
    this.syncFormState();
    this.requestUpdate('schema', old);
  }

  /** Detached, deeply frozen argument snapshot, bounded to 10,000 entries per array/plain record,
   * 50,000 total nodes, and 16 nested levels. Reassign after changing it. */
  get value(): ToolParamFormValue {
    return this._value;
  }
  set value(next: ToolParamFormValue) {
    const old = this._value;
    const snapshot = snapshotFormValue(next);
    this._value = snapshot.value;
    this.valueInputInvalid = snapshot.invalid;
    this.valueInputTruncated = snapshot.truncated;
    this.syncFormState();
    this.requestUpdate('value', old);
  }

  /** Submission key for the optional native `<form>` participation, reflected synchronously. */
  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    // Disabling bars constraint validation, so the published validity and `:state()` hooks change
    // even though the value did not.
    this.applyValidity();
    this.requestUpdate('disabled', old);
  }

  /** Whether the form is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /** The current effective validation errors. Intrinsic errors are keyed by their property;
   * a whole-control or caller-supplied custom error is keyed by the `base` part. */
  get errors(): Readonly<Record<string, string>> {
    return this.publicValidityErrors();
  }

  private publicValidityErrors(): Readonly<Record<string, string>> {
    const errors: Record<string, string> = { ...this._errors };
    if (this.willValidate) {
      const wholeControlError = this.validityController.customValidityMessage || this._formError;
      if (wholeControlError) errors['base'] = this.validationMessage;
    }
    return Object.freeze(errors);
  }

  private publishValiditySnapshot(): void {
    if (!this.isConnected) return;
    const valid = !this.willValidate || this.validity.valid;
    const errors = valid ? Object.freeze({}) : this.publicValidityErrors();
    const key = JSON.stringify({ valid, errors });
    if (key === this.lastValidityKey) return;
    this.lastValidityKey = key;
    this.emit('lr-validity-change', Object.freeze({ valid, errors }));
  }

  /** A schema-wide or JSON-serialization error that cannot be assigned to one field. */
  get formError(): string {
    return this._formError;
  }

  /**
   * Computes the supported flat JSON Schema subset against the exact value
   * that will be submitted. Defaults are already materialized in `effective`.
   */
  private computeValidation(effective: Record<string, unknown>): {
    errors: Record<string, string>;
    flags: ValidityStateFlags;
  } {
    const props = this.schemaProperties;
    const required = new Set(this.requiredKeys);
    const out: Record<string, string> = {};
    const flags: ValidityStateFlags = {};
    const addError = (key: string, message: string): void => {
      Object.defineProperty(out, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: message,
      });
    };

    for (const [key, prop] of Object.entries(props)) {
      const type = (prop as unknown as { type?: unknown })?.type;
      if (type !== 'string' && type !== 'number' && type !== 'integer' && type !== 'boolean') {
        addError(key, this.localize('unsupportedFieldType', undefined, { type: String(type) }));
        flags.customError = true;
        continue;
      }

      const present = Object.prototype.hasOwnProperty.call(effective, key) && effective[key] !== undefined;
      if (!present) {
        if (required.has(key)) {
          addError(key, this.localize('fieldRequired'));
          flags.valueMissing = true;
        }
        continue;
      }

      const v = effective[key];
      if (type === 'string' && typeof v !== 'string') {
        addError(key, this.localize('fieldMustBeString'));
        flags.typeMismatch = true;
        continue;
      }
      if (type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) {
        addError(key, this.localize('fieldMustBeNumber'));
        flags.typeMismatch = true;
        continue;
      }
      if (type === 'integer' && (typeof v !== 'number' || !Number.isFinite(v))) {
        addError(key, this.localize('fieldMustBeInteger'));
        flags.typeMismatch = true;
        continue;
      }
      if (type === 'integer' && !Number.isInteger(v)) {
        addError(key, this.localize('fieldMustBeInteger'));
        flags.stepMismatch = true;
        continue;
      }
      if (type === 'boolean' && typeof v !== 'boolean') {
        addError(key, this.localize('fieldMustBeBoolean'));
        flags.typeMismatch = true;
        continue;
      }

      if (type === 'string' && Array.isArray(prop.enum) && !prop.enum.includes(v as string)) {
        addError(
          key,
          this.localize('fieldMustBeOneOf', undefined, {
            values: getListFormat(this.effectiveLocale, { style: 'long', type: 'disjunction' }).format(prop.enum),
          }),
        );
        flags.customError = true;
        continue;
      }
      if (prop.const !== undefined && v !== prop.const) {
        addError(key, this.localize('fieldMustEqual', undefined, { value: JSON.stringify(prop.const) }));
        flags.customError = true;
      }
    }

    for (const key of required) {
      if (Object.prototype.hasOwnProperty.call(props, key)) continue;
      if (!Object.prototype.hasOwnProperty.call(effective, key) || effective[key] === undefined) {
        addError(key, this.localize('fieldRequired'));
        flags.valueMissing = true;
      }
    }

    return { errors: out, flags };
  }

  /** Resynchronizes validity without revealing inline errors. */
  checkValidity(): boolean {
    this.syncFormState();
    return this.internals.checkValidity();
  }

  /**
   * Reveals every current field/root error (as if each field had been
   * visited) and returns overall validity — the hook a
   * consumer's own Submit/Approve button should call right before acting,
   * mirroring a native `<form>`'s `reportValidity()`.
   */
  reportValidity(): boolean {
    // A reportValidity() call is what a submit attempt runs, so it counts as interaction for the
    // `user-valid`/`user-invalid` states — set before syncFormState(), which is what republishes
    // them.
    this.hasInteracted = true;
    this.syncFormState();
    if (Object.keys(this._errors).length > 0) {
      this.touchedFields = new Set([...this.touchedFields, ...Object.keys(this._errors)]);
    }
    if (this._formError) this.showFormError = true;
    const valid = this.internals.reportValidity();
    if (!valid && !this.firstInvalidField() && this.missingRequiredKeys.length > 0) {
      void this.updateComplete.then(() => {
        const error = this.firstMissingPropertyError();
        this.validityController.refreshAnchor();
        error?.focus();
      });
    }
    return valid;
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection the
   * schema cannot express ("the tool rejected these arguments"). A non-empty `message` raises
   * `customError` and becomes `validationMessage`, so the form fails `checkValidity()`, blocks
   * submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Two layers, not one: this control already raises `customError` intrinsically for a malformed
   * schema or an unsupported field type, and `setCustomValidity('')` clears only the consumer's own
   * layer — a still-malformed schema stays invalid, with its own message restored. Clearing
   * likewise never forces a form with an unmet `required` property valid, and the consumer's error
   * survives every intrinsic recomputation in between (each field edit re-runs `syncFormState()`)
   * and a `form.reset()`, matching a native control.
   *
   * Whole-control state: the message is exposed as `errors.base`, keyed to this control's `base`
   * part. It is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncValidityCustomStates();
    this.publishValiditySnapshot();
  }

  formResetCallback(): void {
    // Cleared before the `value` assignment below, whose setter is what republishes the custom
    // states — a reset form is pristine again, so `user-valid`/`user-invalid` must drop off it.
    this.hasInteracted = false;
    this.value = cloneFormValue(this.defaultValueSnapshot, this.ownerDocument.defaultView);
    this.touchedFields = new Set();
    this.showFormError = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    let restored: Record<string, unknown> = {};
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          restored = parsed as Record<string, unknown>;
        }
      } catch {
        // Invalid persisted state restores the safe empty object.
      }
    }
    this.value = restored;
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.applyValidity();
    this.requestUpdate();
  }

  private schemaShapeError(): string {
    if (this.schemaInputShapeError === 'object') {
      return this.localize('schemaMustBeObject');
    }
    if (this.schemaInputShapeError === 'properties') {
      return this.localize('schemaPropertiesMustBeFlat');
    }
    if (this.schemaInputExceededLimits) {
      return this.localize('toolParamSchemaLimit', undefined, {
        fields: getNumberFormat(this.effectiveLocale).format(MAX_SCHEMA_FIELDS),
        options: getNumberFormat(this.effectiveLocale).format(MAX_ENUM_OPTIONS),
      });
    }
    return '';
  }

  private serializeEffectiveValue(effective: ToolParamFormValue): string {
    const serialized = JSON.stringify(effective, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError('Non-finite numbers are not JSON values.');
      }
      return value;
    });
    if (typeof serialized !== 'string') throw new TypeError('Value did not serialize to JSON.');
    return serialized;
  }

  /**
   * Shared with every other form control in the library: own `disabled` and a `<fieldset disabled>`
   * ancestor both bar constraint validation, so a barred form reports no failure and publishes
   * neither `:state(invalid)` nor `:state(user-invalid)` — see `internal/custom-states.ts`.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /** Pushes the already-computed snapshot into `ElementInternals`. */
  private syncInternals(formValue: string | null): void {
    this.internals.setFormValue(formValue, formValue);
    this.applyValidity();
  }

  /**
   * Publishes the current constraint state. Split out of {@linkcode syncInternals} because
   * becoming (or ceasing to be) barred changes the answer without changing the submitted value.
   */
  private applyValidity(): void {
    if (!this.validityController) return;
    if (this.barredFromValidation || Object.keys(this._validityFlags).length === 0) {
      this.validityController.setValidity({});
    } else {
      // Every branch that sets a _validityFlags flag (this else-branch's precondition) also sets
      // a matching entry in _errors or a truthy _formError, so one of these two is always present.
      const firstMessage = Object.values(this._errors)[0] ?? this._formError;
      this.validityController.setValidity(this._validityFlags, firstMessage);
    }
    this.syncValidityCustomStates();
    this.publishValiditySnapshot();
  }

  /**
   * Republishes the six `:state()` validity hooks — see `internal/custom-states.ts`. Called from
   * `syncInternals()` (so every validity recomputation carries them) and from `markTouched()` (the
   * one interaction that changes the answer without touching validity).
   *
   * `required` here means "the schema declares at least one required property", which is the only
   * whole-control reading available: this control's value is an object, so requiredness is per
   * property, and a consumer styling `lr-tool-param-form:state(required)` is asking "does this form
   * demand anything of the user".
   */
  private syncValidityCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.requiredKeys.length > 0,
      hasInteracted: this.hasInteracted,
      barred: this.barredFromValidation,
    });
  }

  private syncFormState(): void {
    let effective: ToolParamFormValue = Object.freeze({});
    let errors: Record<string, string> = {};
    let flags: ValidityStateFlags = {};
    let formError = '';
    let formValue: string | null = null;

    try {
      formError = this.schemaShapeError();
      if (this.valueInputInvalid || this.valueInputTruncated) {
        throw new TypeError('The value could not be retained within the public snapshot boundary.');
      }
      effective = this.resolveEffectiveValue();
      const validation = this.computeValidation(effective);
      errors = validation.errors;
      flags = validation.flags;
      formValue = this.serializeEffectiveValue(effective);
    } catch {
      formError = this.localize('valueMustBeSerializable');
      formValue = null;
    }

    if (formError) {
      flags.customError = true;
      formValue = null;
    }
    this._effectiveValue = effective;
    if (JSON.stringify(this._errors) !== JSON.stringify(errors)) this._errors = errors;
    this._formError = formError;
    this._validityFlags = flags;
    this.syncInternals(formValue);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.publishValiditySnapshot();
    if (changed.has('value') || changed.has('schema') || changed.has('_errors') || changed.has('_formError')) {
      const nestedUpdates = Array.from(this.firstInvalidField()?.children ?? [])
        .filter((element) => typeof (element as unknown as Record<PropertyKey, unknown>)[VALIDITY_ANCHOR] === 'function')
        .map((element) => (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete)
        .filter((update): update is Promise<unknown> => update !== undefined);
      if (nestedUpdates.length > 0) {
        void Promise.all(nestedUpdates).then(() => this.validityController.refreshAnchor());
      }
    }

    const currentErrors = new Map<string, string>();
    for (const node of this.renderRoot.querySelectorAll<HTMLElement>('[part="error"]')) {
      const fieldKey = node.closest<HTMLElement>('[part~="field"]')?.dataset['key'];
      const key = node.dataset['key'] ?? fieldKey ?? 'form';
      const text = node.textContent?.trim() ?? '';
      if (text) currentErrors.set(key, text);
    }
    if (!this.suppressNextErrorAnnouncement) {
      const freshMessages: string[] = [];
      for (const [key, text] of currentErrors) {
        if (this.visibleErrorSnapshot.get(key) !== text && !freshMessages.includes(text)) {
          freshMessages.push(text);
        }
      }
      // A submit attempt can reveal several fields in one render. Speak that as one concise
      // addition instead of firing a burst of competing assertive announcements.
      if (freshMessages.length > 0) this.errorAnnouncementSink?.announce(freshMessages.join(' '));
    }
    this.visibleErrorSnapshot = currentErrors;
    this.suppressNextErrorAnnouncement = false;
  }

  private setFieldValue(key: string, val: unknown): void {
    if (this.effectiveDisabled) return;
    // Set before the `value` assignment, whose setter republishes the custom states.
    this.hasInteracted = true;
    this.value = { ...this.value, [key]: val };
    this.emit('lr-input', { value: this.effectiveValue });
  }

  private markTouched(key: string): void {
    // Visiting a field is interaction even if the user changed nothing, so this runs before the
    // early return below — and republishes explicitly, since nothing here touches validity.
    this.hasInteracted = true;
    this.syncValidityCustomStates();
    if (this.touchedFields.has(key)) return;
    this.touchedFields = new Set(this.touchedFields).add(key);
  }

  private onTextInput(key: string, e: Event): void {
    this.setFieldValue(key, (e.target as HTMLInputElement).value);
  }

  private onNumberInput(key: string, e: Event): void {
    const raw = e.target as HTMLInputElement;
    const n = raw.valueAsNumber;
    this.setFieldValue(key, Number.isNaN(n) ? undefined : n);
  }

  private onSelectChange(key: string, e: Event): void {
    e.stopPropagation();
    this.setFieldValue(key, (e.target as LyraSelect).value);
  }

  private onBooleanSelectChange(key: string, e: Event): void {
    e.stopPropagation();
    const value = (e.target as LyraSelect).value;
    if (value === '') {
      if (this.effectiveDisabled) return;
      this.hasInteracted = true;
      const next = { ...this.value };
      Reflect.deleteProperty(next, key);
      this.value = next;
      this.emit('lr-input', { value: this.effectiveValue });
      return;
    }
    this.setFieldValue(key, value === 'true');
  }

  private stopNestedControlEvent = (e: Event): void => {
    e.stopPropagation();
  };

  // Native blur/focus neither bubble nor cross the shadow boundary, so a host
  // listener on <lr-tool-param-form> itself never hears them without this --
  // mirrors <lr-tool-approval-dialog>'s/<lr-tool-select-dialog>'s identical
  // native-input focus/blur bridge.
  private onFieldFocus = (): void => {
    this.emit('focus');
  };
  private onFieldBlur = (): void => {
    this.emit('blur');
  };

  private renderControl(
    key: string,
    prop: ToolParamFormProperty,
    fieldId: string,
    label: string,
    required: boolean,
    describedBy: string,
    errorMessage: string,
    effective: unknown,
  ): TemplateResult {
    if (prop.type === 'string' && prop.enum && prop.enum.length > 0) {
      return html`<lr-select
        id=${fieldId}
        .label=${label}
        .hint=${prop.description ?? ''}
        .errorText=${errorMessage}
        .required=${false}
        aria-required=${required ? 'true' : 'false'}
        .value=${typeof effective === 'string' ? effective : ''}
        ?disabled=${this.effectiveDisabled}
        @input=${this.stopNestedControlEvent}
        @lr-input=${this.stopNestedControlEvent}
        @change=${(e: Event) => this.onSelectChange(key, e)}
        @lr-change=${this.stopNestedControlEvent}
        @lr-show=${this.stopNestedControlEvent}
        @lr-hide=${this.stopNestedControlEvent}
        @lr-option-change=${this.stopNestedControlEvent}
      >
        ${prop.enum.map((v) => html`<lr-option value=${v}>${v}</lr-option>`)}
      </lr-select>`;
    }
    if (prop.type === 'string') {
      return html`<input
        class="control"
        part="control"
        type="text"
        id=${fieldId}
        aria-describedby=${describedBy || nothing}
        aria-required=${required ? 'true' : 'false'}
        aria-invalid=${errorMessage ? 'true' : 'false'}
        autocomplete=${prop.autocomplete || nothing}
        .spellcheck=${prop.spellcheck ?? true}
        autocapitalize=${prop.autocapitalize || nothing}
        autocorrect=${prop.autoCorrect || nothing}
        inputmode=${prop.inputMode || nothing}
        enterkeyhint=${prop.enterKeyHint || nothing}
        .value=${typeof effective === 'string' ? effective : ''}
        ?disabled=${this.effectiveDisabled}
        @input=${(e: Event) => this.onTextInput(key, e)}
        @focus=${this.onFieldFocus}
        @blur=${this.onFieldBlur}
      />`;
    }
    if (prop.type === 'number' || prop.type === 'integer') {
      const numValue = typeof effective === 'number' && !Number.isNaN(effective) ? String(effective) : '';
      return html`<input
        class="control"
        part="control"
        type="number"
        id=${fieldId}
        step=${prop.type === 'integer' ? '1' : 'any'}
        aria-describedby=${describedBy || nothing}
        aria-required=${required ? 'true' : 'false'}
        aria-invalid=${errorMessage ? 'true' : 'false'}
        .value=${numValue}
        ?disabled=${this.effectiveDisabled}
        @input=${(e: Event) => this.onNumberInput(key, e)}
        @focus=${this.onFieldFocus}
        @blur=${this.onFieldBlur}
      />`;
    }
    if (prop.type === 'boolean') {
      const selected = effective === true ? 'true' : effective === false ? 'false' : '';
      return html`<lr-select
        id=${fieldId}
        .label=${label}
        .hint=${prop.description ?? ''}
        .errorText=${errorMessage}
        .required=${false}
        aria-required=${required ? 'true' : 'false'}
        .value=${selected}
        ?disabled=${this.effectiveDisabled}
        @input=${this.stopNestedControlEvent}
        @lr-input=${this.stopNestedControlEvent}
        @change=${this.stopNestedControlEvent}
        @lr-change=${(e: Event) => this.onBooleanSelectChange(key, e)}
      >
        <lr-option value="">${this.localize('toolParamBooleanUnset')}</lr-option>
        <lr-option value="true">${this.localize('toolParamBooleanTrue')}</lr-option>
        <lr-option value="false">${this.localize('toolParamBooleanFalse')}</lr-option>
      </lr-select>`;
    }
    // Defensive fallback for a schema property outside this renderer's scope
    // (see the class doc) — render a visible note instead of silently
    // dropping the field or throwing. Still carries id=fieldId like every
    // other control-slot render, since renderField's shared, non-boolean
    // branch above always renders a <label for=fieldId> pointing at it.
    return html`<p part="unsupported" class="unsupported" id=${fieldId}>${this.localize('unsupportedFieldType', undefined, { type: String((prop as { type?: unknown }).type) })}</p>`;
  }

  private renderField(key: string, prop: ToolParamFormProperty, index: number): TemplateResult {
    const required = this.requiredKeys.includes(key);
    const label = prop.title ?? key;
    const fieldId = `${this.baseId}-f${index}`;
    const descId = prop.description ? `${fieldId}-desc` : '';
    const errId = this._errors[key] ? `${fieldId}-err` : '';
    const describedBy = [descId, this.touchedFields.has(key) ? errId : ''].filter(Boolean).join(' ');
    const hasError = this.touchedFields.has(key) && Boolean(this._errors[key]);
    const errorMessage = hasError ? (this._errors[key] ?? '') : '';
    const effective = this._effectiveValue[key];
    const isBoolean = prop.type === 'boolean';
    const isComposedSelect = prop.type === 'string' && Boolean(prop.enum?.length);

    return html`
      <div part="field" class="field" data-key=${key} data-type=${prop.type} ?data-required=${required}
        @focusout=${() => this.markTouched(key)}
      >
        ${isBoolean || isComposedSelect
          ? nothing
          : html`<label part="label" for=${fieldId}>${label}</label>`}
        ${this.renderControl(key, prop, fieldId, label, required, describedBy, errorMessage, effective)}
        ${prop.description && !isComposedSelect
          ? html`<p part="description" id=${descId}>${prop.description}</p>`
          : nothing}
        ${hasError && !isComposedSelect
          ? html`<p part="error" id=${errId}>${this._errors[key]}</p>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const props = this.schemaProperties;
    const entries = Object.entries(props);
    const missingRequiredKeys = this.missingRequiredKeys.filter((key) => this.touchedFields.has(key));
    const hostLabel = this.getAttribute('aria-label');
    return html`<div
      part="base"
      role="group"
      aria-label=${hostLabel ?? nothing}
    >
      ${entries.length === 0
        ? html`<p part="empty">${this.localize('noData')}</p>`
        : entries.map(([key, prop], i) => this.renderField(key, prop, i))}
      ${missingRequiredKeys.map(
        (key) => html`<p
          part="error"
          class="form-error missing-property-error"
          data-missing-property
          data-key=${key}
          tabindex="-1"
        >${this.localize('toolParamMissingProperty', undefined, { key })}</p>`,
      )}
      ${this.showFormError && this._formError
        ? html`<p part="error" class="form-error">${this._formError}</p>`
        : nothing}
    </div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-param-form': LyraToolParamForm;
  }
}
