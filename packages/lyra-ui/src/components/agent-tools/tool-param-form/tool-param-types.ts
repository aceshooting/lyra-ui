export type ToolParamStringFormat = 'email' | 'uri' | 'date' | 'date-time';
export interface ToolParamEnumOption { readonly const: string; readonly title: string; }
export interface ToolParamEnumItems {
  readonly type?: 'string';
  readonly enum?: readonly string[];
  readonly anyOf?: readonly ToolParamEnumOption[];
}

/** Primitive properties and bounded string-enum arrays supported by this flat-schema renderer. */
export type ToolParamFormPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'array';
export type ToolParamFormPrimitive = string | number | boolean;

/**
 * One `schema.properties` entry. Deliberately shallow — see the class doc for
 * the full scope limitation this type encodes.
 */
export interface ToolParamFormProperty {
  readonly type: ToolParamFormPropertyType;
  /** A closed set of string choices, rendered as a `<lr-select>`. Only meaningful when `type` is `'string'`. */
  readonly enum?: readonly string[];
  /** Display labels corresponding to `enum` values. */
  readonly enumNames?: readonly string[];
  /** Titled single-select choices. Only string constants are supported. */
  readonly oneOf?: readonly ToolParamEnumOption[];
  /** String-enum array items, using `enum` or titled `anyOf` choices. */
  readonly items?: ToolParamEnumItems;
  /** Minimum and maximum Unicode code-point length of a string. */
  readonly minLength?: number;
  readonly maxLength?: number;
  /** Supported string format validation. */
  readonly format?: ToolParamStringFormat;
  /** Inclusive finite numeric bounds. */
  readonly minimum?: number;
  readonly maximum?: number;
  /** Minimum and maximum number of selected string-enum items. */
  readonly minItems?: number;
  readonly maxItems?: number;
  /** Helper text rendered under the field. */
  readonly description?: string;
  /** Display label. Falls back to the property key itself when omitted. */
  readonly title?: string;
  /** Pre-filled value used whenever `value` doesn't already have this key. */
  readonly default?: unknown;
  /** Exact primitive value required when the property is present. For a `'string'` (non-enum) or
   * `'number'`/`'integer'` property, `const` also pre-fills the field (taking priority over
   * `default` when both are present) and renders its control `readonly` — visible, focusable and
   * still submitted, but not editable. The `'boolean'`/enum `<lr-select>` fields are unaffected:
   * `const` there remains pure post-touch validation. */
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
 * a plain object whose properties are strings, numbers/integers, booleans,
 * string enums, or arrays of string-enum choices. See the class doc for what's out of scope.
 */
export interface FlatToolParamSchema {
  readonly type: 'object';
  /** Optional JSON Schema dialect identifier; the renderer still applies its documented subset. */
  readonly $schema?: string;
  readonly properties: Readonly<Record<string, ToolParamFormProperty>>;
  readonly required?: readonly string[];
}

export type ToolParamFormValue = Readonly<Record<string, unknown>>;
