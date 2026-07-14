import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import {
  AnchoredValidityController,
  resolveValidityAnchor,
  VALIDITY_ANCHOR,
} from '../../internal/anchored-validity.js';
import { styles } from './tool-param-form.styles.js';
import type { LyraSelect } from '../select/select.class.js';
import '../select/select.class.js';
import '../combobox/option.class.js';
import '../checkbox/checkbox.class.js';

/** The four leaf property types this flat-schema renderer understands. */
export type ToolParamFormPropertyType = 'string' | 'number' | 'integer' | 'boolean';
export type ToolParamFormPrimitive = string | number | boolean;

/**
 * One `schema.properties` entry. Deliberately shallow — see the class doc for
 * the full scope limitation this type encodes.
 */
export interface ToolParamFormProperty {
  type: ToolParamFormPropertyType;
  /** A closed set of string choices, rendered as a `<lyra-select>`. Only meaningful when `type` is `'string'`. */
  enum?: string[];
  /** Helper text rendered under the field. */
  description?: string;
  /** Display label. Falls back to the property key itself when omitted. */
  title?: string;
  /** Pre-filled value used whenever `value` doesn't already have this key. */
  default?: unknown;
  /** Exact primitive value required when the property is present. */
  const?: ToolParamFormPrimitive;
}

/**
 * The (intentionally flat) JSON Schema subset this component can render:
 * a plain object whose every property is a string, number/integer, boolean,
 * or string enum. See the class doc for what's out of scope.
 */
export interface ToolParamFormSchema {
  type: 'object';
  properties: Record<string, ToolParamFormProperty>;
  required?: string[];
}

const EMPTY_SCHEMA: ToolParamFormSchema = { type: 'object', properties: {} };

export interface LyraToolParamFormEventMap {
  'lyra-validity-change': CustomEvent<{ valid: boolean; errors: Record<string, string> }>;
  'lyra-input': CustomEvent<{ value: Record<string, unknown> }>;
}
/**
 * `<lyra-tool-param-form>` — renders one form control per top-level property
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
 *
 * Fields render in `Object.keys(schema.properties)` order (insertion order,
 * which is reliable for a plain object's string keys). A field's label is
 * `title ?? ` the property key; `description` renders as helper text below
 * the control; a key listed in `required` gets a visible `*`. The outer
 * component owns validation because JSON Schema `required` means property
 * presence, unlike HTML controls' nonempty/must-check semantics.
 *
 * This component owns no Submit/Cancel/Approve chrome — a consumer composes
 * it inside their own dialog (e.g. a tool-approval dialog) and reads
 * `.value`/`.errors`/`checkValidity()` (or calls `reportValidity()` right
 * before acting, which also reveals any inline errors that user interaction
 * hasn't surfaced yet).
 *
 * `value` is exactly what the consumer last set it to — a field with no
 * entry in `value` but a schema `default` displays (and is *emitted*, via
 * `lyra-input`) as that default, but the `value` *property* itself is left
 * alone until the user actually edits that field. This mirrors an
 * uncontrolled `<input placeholder>` not writing to `.value`, and means the
 * very first `lyra-input` a consumer receives already carries every default
 * resolved, so round-tripping `e.detail.value` back into `.value` converges
 * after one edit. JSON Schema defines `default` as an annotation; this form
 * renderer deliberately materializes it before validation and submission,
 * so a valid default can satisfy `required` here.
 *
 * Optional native `<form>` participation is implemented via `ElementInternals`
 * attached directly (this component's value is a whole object, not a plain
 * string, so the `FormAssociated` string-value mixin doesn't fit — same
 * shape as `<lyra-combobox>`'s array-valued case). This is a nice-to-have
 * layered on top of the primary integration contract (`value` +
 * `lyra-input`/`lyra-validity-change`), not a requirement: a consumer that
 * never puts this inside a `<form>` loses nothing.
 *
 * @customElement lyra-tool-param-form
 * @event lyra-input - A field's value changed. `detail: { value }` — the
 * full current value object (every property, defaults resolved), not just
 * the field that changed.
 * @event lyra-validity-change - Overall validity or field errors changed.
 * `detail: { valid: boolean; errors: Record<string, string> }`.
 * @csspart base - The outer wrapper around all fields.
 * @csspart field - One property's wrapper (label + control + description + error).
 * @csspart label - A field's label.
 * @csspart description - A field's helper text, from `schema.description`.
 * @csspart error - A field-level or form-level validation message.
 * @csspart unsupported - The fallback note rendered in place of a control for
 * a property whose `type` is outside this renderer's scope.
 * @csspart empty - The message shown when `schema.properties` has no entries.
 */
export class LyraToolParamForm extends LyraElement<LyraToolParamFormEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
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
  // form control in this library (lyra-select/lyra-combobox/lyra-model-select
  // all avoid flashing red before the user has touched anything).
  @state() private touchedFields = new Set<string>();

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private baseId = nextId('tool-param-form');
  private _fieldsetDisabled = false;
  private _name = '';
  private _schema: ToolParamFormSchema = EMPTY_SCHEMA;
  private _value: Record<string, unknown> = {};
  private _effectiveValue: Record<string, unknown> = {};
  private _validityFlags: ValidityStateFlags = {};
  private _disabled = false;
  // Guards lyra-validity-change so it only fires on an actual change, not on
  // every render — `undefined` guarantees the first computed state always
  // "changes" from it, so mounting with an unmet required field still
  // announces `valid:false` once up front.
  private lastValidityKey: string | undefined;

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.syncFormState();
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
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
    if (!field) return undefined;
    const input = field.querySelector<HTMLElement>('input.control');
    if (input) return input;
    for (const child of field.children) {
      const anchor = resolveValidityAnchor(child);
      if (anchor) return anchor;
    }
    return undefined;
  }

  private firstInvalidField(): HTMLElement | undefined {
    const firstInvalidKey = Object.keys(this._errors)[0];
    if (!firstInvalidKey || !this.renderRoot) return undefined;
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[part="field"]')).find(
      (candidate) => candidate.dataset.key === firstInvalidKey,
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Seed `errors`/`internals` validity synchronously at connect time —
    // `checkValidity()`/a wrapping `<form>`'s own `reportValidity()` must
    // see the correct answer even if called before Lit's first (async)
    // update has run, mirroring lyra-select's/lyra-checkbox's identical
    // connectedCallback -> updateValidity() call.
    this.syncFormState();
  }

  /** `value`, with any property missing from it filled in from `schema`'s own `default` — see the class doc. */
  get effectiveValue(): Record<string, unknown> {
    return { ...this._effectiveValue };
  }

  private get schemaProperties(): Record<string, ToolParamFormProperty> {
    const properties = (this.schema as unknown as { properties?: unknown })?.properties;
    return properties !== null && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, ToolParamFormProperty>)
      : {};
  }

  private get requiredKeys(): string[] {
    const required = (this.schema as unknown as { required?: unknown })?.required;
    return Array.isArray(required) ? required.filter((key): key is string => typeof key === 'string') : [];
  }

  private resolveEffectiveValue(): Record<string, unknown> {
    const props = this.schemaProperties;
    const out: Record<string, unknown> = { ...this.value };
    for (const key of Object.keys(props)) {
      // `hasOwnProperty`, not `out[key] === undefined` — a number field the
      // user has explicitly cleared is `{ days: undefined }` (a real own
      // property, via the `{...this.value, [key]: val}` spread in
      // setFieldValue()), and must stay cleared rather than silently
      // snapping back to its default just because its current value also
      // happens to be `undefined`. Only a key genuinely absent from `value`
      // (never touched, or reset back to `{}`) falls back to the default.
      if (!Object.prototype.hasOwnProperty.call(this.value, key) && props[key].default !== undefined) {
        Object.defineProperty(out, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: props[key].default,
        });
      }
    }
    return out;
  }

  get schema(): ToolParamFormSchema {
    return this._schema;
  }
  set schema(next: ToolParamFormSchema) {
    const old = this._schema;
    this._schema = next ?? EMPTY_SCHEMA;
    this.syncFormState();
    this.requestUpdate('schema', old);
  }

  get value(): Record<string, unknown> {
    return this._value;
  }
  set value(next: Record<string, unknown>) {
    const old = this._value;
    this._value = next ?? {};
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
    this.requestUpdate('disabled', old);
  }

  /** Whether the form is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /**
   * The current per-field validation errors (`{ [propertyKey]: message }`) —
   * required presence, primitive type, integer, enum, const, or unsupported
   * type — mirrors the last `lyra-validity-change` event's `errors`.
   * Independent of which fields have been visited; a consumer wanting the
   * visited-only, screen-reader-announced subset should read the rendered
   * `[part="error"]` elements instead.
   */
  get errors(): Record<string, string> {
    return { ...this._errors };
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

    for (const key of Object.keys(props)) {
      const prop = props[key];
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
        addError(key, this.localize('fieldMustBeOneOf', undefined, { values: prop.enum.join(', ') }));
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
    this.syncFormState();
    if (Object.keys(this._errors).length > 0) {
      this.touchedFields = new Set([...this.touchedFields, ...Object.keys(this._errors)]);
    }
    if (this._formError) this.showFormError = true;
    return this.internals.reportValidity();
  }

  formResetCallback(): void {
    this.value = {};
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
    this.requestUpdate();
  }

  private schemaShapeError(): string {
    const schema = this.schema as unknown;
    if (schema === null || typeof schema !== 'object' || (schema as { type?: unknown }).type !== 'object') {
      return this.localize('schemaMustBeObject');
    }
    const properties = (schema as { properties?: unknown }).properties;
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
      return this.localize('schemaPropertiesMustBeFlat');
    }
    return '';
  }

  private serializeEffectiveValue(effective: Record<string, unknown>): string {
    const serialized = JSON.stringify(effective, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError('Non-finite numbers are not JSON values.');
      }
      return value;
    });
    if (typeof serialized !== 'string') throw new TypeError('Value did not serialize to JSON.');
    return serialized;
  }

  /** Pushes the already-computed snapshot into `ElementInternals`. */
  private syncInternals(formValue: string | null): void {
    this.internals.setFormValue(formValue, formValue);
    if (Object.keys(this._validityFlags).length === 0) {
      this.validityController.setValidity({});
    } else {
      const firstMessage = Object.values(this._errors)[0] ?? this._formError ?? this.localize('valueInvalid');
      this.validityController.setValidity(this._validityFlags, firstMessage);
    }
  }

  private syncFormState(): void {
    let effective: Record<string, unknown> = {};
    let errors: Record<string, string> = {};
    let flags: ValidityStateFlags = {};
    let formError = '';
    let formValue: string | null = null;

    try {
      formError = this.schemaShapeError();
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

  protected updated(changed: PropertyValues): void {
    if (changed.has('value') || changed.has('schema') || changed.has('_errors') || changed.has('_formError')) {
      const valid = Object.keys(this._errors).length === 0 && this._formError === '';
      const key = JSON.stringify({ valid, errors: this._errors, formError: this._formError });
      if (key !== this.lastValidityKey) {
        this.lastValidityKey = key;
        this.emit('lyra-validity-change', { valid, errors: { ...this._errors } });
      }
      const nestedUpdates = Array.from(this.firstInvalidField()?.children ?? [])
        .filter((element) => typeof (element as unknown as Record<PropertyKey, unknown>)[VALIDITY_ANCHOR] === 'function')
        .map((element) => (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete)
        .filter((update): update is Promise<unknown> => update !== undefined);
      if (nestedUpdates.length > 0) {
        void Promise.all(nestedUpdates).then(() => this.validityController.refreshAnchor());
      }
    }
  }

  private setFieldValue(key: string, val: unknown): void {
    if (this.effectiveDisabled) return;
    this.value = { ...this.value, [key]: val };
    this.emit('lyra-input', { value: this.effectiveValue });
  }

  private markTouched(key: string): void {
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
    this.setFieldValue(key, (e.target as LyraSelect).value);
  }

  private onCheckboxChange(key: string, e: CustomEvent<{ checked: boolean }>): void {
    this.setFieldValue(key, e.detail.checked);
  }

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
      // <lyra-select>/<lyra-checkbox> don't forward a host-level
      // aria-describedby to their internal focusable element (neither
      // reads it — and this component doesn't own either file to add that),
      // so a plain aria-describedby here would silently do nothing for
      // assistive tech. Fold the error into aria-label instead, which both
      // select.ts and checkbox.ts *do* read from the host and thread
      // through -- the description text still reads fine from its adjacent,
      // DOM-order-following <p part="description"> even without a formal
      // aria-describedby association.
      return html`<lyra-select
        id=${fieldId}
        aria-label=${errorMessage ? `${label}. ${errorMessage}` : label}
        aria-required=${required ? 'true' : nothing}
        .value=${typeof effective === 'string' ? effective : ''}
        ?disabled=${this.effectiveDisabled}
        @change=${(e: Event) => this.onSelectChange(key, e)}
      >
        ${prop.enum.map((v) => html`<lyra-option value=${v}>${v}</lyra-option>`)}
      </lyra-select>`;
    }
    if (prop.type === 'string') {
      return html`<input
        class="control"
        type="text"
        id=${fieldId}
        aria-describedby=${describedBy || nothing}
        aria-required=${required ? 'true' : nothing}
        aria-invalid=${errorMessage ? 'true' : nothing}
        .value=${typeof effective === 'string' ? effective : ''}
        ?disabled=${this.effectiveDisabled}
        @input=${(e: Event) => this.onTextInput(key, e)}
      />`;
    }
    if (prop.type === 'number' || prop.type === 'integer') {
      const numValue = typeof effective === 'number' && !Number.isNaN(effective) ? String(effective) : '';
      return html`<input
        class="control"
        type="number"
        id=${fieldId}
        step=${prop.type === 'integer' ? '1' : 'any'}
        aria-describedby=${describedBy || nothing}
        aria-required=${required ? 'true' : nothing}
        aria-invalid=${errorMessage ? 'true' : nothing}
        .value=${numValue}
        ?disabled=${this.effectiveDisabled}
        @input=${(e: Event) => this.onNumberInput(key, e)}
      />`;
    }
    if (prop.type === 'boolean') {
      // The label lives inside the slot rather than as a sibling <label> --
      // that slot *is* lyra-checkbox's documented way to give it an
      // accessible name (see checkbox.ts's own @slot doc), and unlike
      // aria-describedby, this genuinely works since it's real slotted
      // content, not an inert host attribute. Once there's an error, fold it
      // into aria-label the same way the enum/select branch above does --
      // an explicit aria-label overrides the slotted accessible name, so the
      // normal (no error) case is left alone to keep deriving its name from
      // the slot per lyra-checkbox's own documented contract.
      return html`<lyra-checkbox
        id=${fieldId}
        aria-label=${errorMessage ? `${label}. ${errorMessage}` : nothing}
        ?checked=${effective === true}
        ?disabled=${this.effectiveDisabled}
        @lyra-change=${(e: CustomEvent<{ checked: boolean }>) => this.onCheckboxChange(key, e)}
      >
        <span part="label">${label}</span>
      </lyra-checkbox>`;
    }
    // Defensive fallback for a schema property outside this renderer's scope
    // (see the class doc) — render a visible note instead of silently
    // dropping the field or throwing. Still carries id=fieldId like every
    // other control-slot render, since renderField's shared, non-boolean
    // branch above always renders a <label for=fieldId> pointing at it.
    return html`<p part="unsupported" class="unsupported" id=${fieldId}>${this.localize('unsupportedFieldType', undefined, { type: (prop as { type: string }).type })}</p>`;
  }

  private renderField(key: string, prop: ToolParamFormProperty, index: number): TemplateResult {
    const required = this.requiredKeys.includes(key);
    const label = prop.title ?? key;
    const fieldId = `${this.baseId}-f${index}`;
    const descId = prop.description ? `${fieldId}-desc` : '';
    const errId = this._errors[key] ? `${fieldId}-err` : '';
    const describedBy = [descId, this.touchedFields.has(key) ? errId : ''].filter(Boolean).join(' ');
    const hasError = this.touchedFields.has(key) && Boolean(this._errors[key]);
    const errorMessage = hasError ? this._errors[key] : '';
    const effective = this._effectiveValue[key];
    const isBoolean = prop.type === 'boolean';

    return html`
      <div part="field" class="field" data-key=${key} data-type=${prop.type} ?data-required=${required}
        @focusout=${() => this.markTouched(key)}
      >
        ${isBoolean
          ? nothing
          : html`<label part="label" for=${fieldId}>${label}</label>`}
        ${this.renderControl(key, prop, fieldId, label, required, describedBy, errorMessage, effective)}
        ${prop.description
          ? html`<p part="description" id=${descId}>${prop.description}</p>`
          : nothing}
        ${hasError ? html`<p part="error" id=${errId} role="alert">${this._errors[key]}</p>` : nothing}
      </div>
    `;
  }

  render(): TemplateResult {
    const props = this.schemaProperties;
    const keys = Object.keys(props);
    return html`<div part="base">
      ${keys.length === 0
        ? html`<p part="empty">${this.localize('noColumns')}</p>`
        : keys.map((key, i) => this.renderField(key, props[key], i))}
      ${this.showFormError && this._formError
        ? html`<p part="error" class="form-error" role="alert">${this._formError}</p>`
        : nothing}
    </div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-param-form': LyraToolParamForm;
  }
}
