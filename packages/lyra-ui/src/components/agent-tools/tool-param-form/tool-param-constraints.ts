import type { ToolParamFormProperty, ToolParamStringFormat } from './tool-param-types.js';

export interface ToolParamChoice { readonly value: string; readonly label: string; }
export type ToolParamConstraintFailure = 'minLength' | 'maxLength' | 'minimum' | 'maximum' | 'format' | 'minItems' | 'maxItems' | 'selection';
const MAX_CHOICES = 500;
const FORMATS = new Set(['email', 'uri', 'date', 'date-time']);
const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

const choicesCache = new WeakMap<object, readonly ToolParamChoice[] | undefined>();
const constraintsCache = new WeakMap<object, boolean>();

/** Field snapshots have already removed accessors and detached nested values; the result is memoized per field. */
export function toolParamChoices(property: ToolParamFormProperty): readonly ToolParamChoice[] | undefined {
  if (choicesCache.has(property)) return choicesCache.get(property);
  const choices = computeChoices(property);
  choicesCache.set(property, choices);
  return choices;
}

function computeChoices(property: ToolParamFormProperty): readonly ToolParamChoice[] | undefined {
  const titled = property.type === 'array' ? property.items?.anyOf : property.oneOf;
  const values = property.type === 'array' ? property.items?.enum : property.enum;
  if (Array.isArray(titled)) {
    return Object.freeze(titled.slice(0, MAX_CHOICES).filter((option) => option && typeof option.const === 'string' && typeof option.title === 'string')
      .map((option) => Object.freeze({ value: option.const, label: option.title })));
  }
  if (Array.isArray(values)) return Object.freeze(values.slice(0, MAX_CHOICES).map((value, index) => Object.freeze({
    value, label: property.type === 'string' ? property.enumNames?.[index] ?? value : value,
  })));
  return undefined;
}

function validTitledChoices(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_CHOICES && Array.from(value).every((option) =>
    option && typeof option === 'object' && !Array.isArray(option)
    && typeof option.const === 'string' && typeof option.title === 'string'
    && Object.keys(option).every((key) => key === 'const' || key === 'title'));
}
function validStringChoices(value: unknown): boolean {
  return Array.isArray(value) && value.length <= MAX_CHOICES && Array.from(value).every((choice) => typeof choice === 'string');
}

/** Reject malformed constraints before looking at a field's value, including optional fields (memoized per field). */
export function validToolParamConstraints(property: ToolParamFormProperty): boolean {
  let valid = constraintsCache.get(property);
  if (valid === undefined) constraintsCache.set(property, valid = computeValidConstraints(property));
  return valid;
}

function computeValidConstraints(property: ToolParamFormProperty): boolean {
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    const value = property[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) return false;
  }
  for (const key of ['minimum', 'maximum'] as const) {
    const value = property[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) return false;
  }
  for (const [min, max] of [['minLength', 'maxLength'], ['minimum', 'maximum'], ['minItems', 'maxItems']] as const) {
    if (property[min] !== undefined && property[max] !== undefined && property[min]! > property[max]!) return false;
  }
  if (property.format !== undefined && !FORMATS.has(property.format)) return false;
  if (['minLength', 'maxLength', 'format', 'oneOf', 'enumNames'].some((key) => own(property, key)) && property.type !== 'string') return false;
  if (['minimum', 'maximum'].some((key) => own(property, key)) && property.type !== 'number' && property.type !== 'integer') return false;
  if (['minItems', 'maxItems', 'items'].some((key) => own(property, key)) && property.type !== 'array') return false;
  if (property.oneOf !== undefined && (!validTitledChoices(property.oneOf) || property.enum !== undefined)) return false;
  if (property.enumNames !== undefined && (!validStringChoices(property.enumNames) || !property.enum || property.enumNames.length !== property.enum.length)) return false;
  if (property.type === 'array') {
    const items = property.items;
    if (!items || typeof items !== 'object' || Array.isArray(items)) return false;
    if (Object.keys(items).some((key) => key !== 'type' && key !== 'enum' && key !== 'anyOf')) return false;
    if (items.anyOf !== undefined) {
      if (items.enum !== undefined || (items.type !== undefined && items.type !== 'string') || !validTitledChoices(items.anyOf)) return false;
    } else if (items.type !== 'string' || !validStringChoices(items.enum) || items.enum?.length === 0) return false;
  }
  const choices = toolParamChoices(property);
  if (choices && new Set(choices.map((choice) => choice.value)).size !== choices.length) return false;
  return true;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}
function validFormat(value: string, format: ToolParamStringFormat): boolean {
  if (format === 'date') return validDate(value);
  if (format === 'email') {
    const at = value.lastIndexOf('@');
    if (at <= 0 || at !== value.indexOf('@')) return false;
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (!/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    return domain.split('.').every((label) => label.length > 0 && label.length <= 63
      && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label));
  }
  if (format === 'uri') {
    if (!/^[a-z][a-z\d+.-]*:/i.test(value) || /[\s\u0000-\u001f]/.test(value)) return false;
    try { new URL(value); return true; } catch { return false; }
  }
  const match = /^(\d{4}-\d{2}-\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  return !!match && validDate(match[1]!) && Number(match[2]) <= 23 && Number(match[3]) <= 59
    && Number(match[4]) <= 59 && (match[8] === undefined || (Number(match[7]) <= 23 && Number(match[8]) <= 59));
}

export function toolParamConstraintFailure(property: ToolParamFormProperty, value: unknown): ToolParamConstraintFailure | undefined {
  if (typeof value === 'string') {
    // JSON Schema length counts Unicode code points, unlike the native maxlength attribute.
    const length = Array.from(value).length;
    if (property.minLength !== undefined && length < property.minLength) return 'minLength';
    if (property.maxLength !== undefined && length > property.maxLength) return 'maxLength';
    if (property.format !== undefined && !validFormat(value, property.format)) return 'format';
    const choices = toolParamChoices(property);
    if (choices && !choices.some((choice) => choice.value === value)) return 'selection';
  }
  if (typeof value === 'number') {
    if (property.minimum !== undefined && value < property.minimum) return 'minimum';
    if (property.maximum !== undefined && value > property.maximum) return 'maximum';
  }
  if (property.type === 'array') {
    if (!Array.isArray(value)) return 'selection';
    const choices = new Set(toolParamChoices(property)?.map((choice) => choice.value));
    if (value.some((entry) => typeof entry !== 'string' || !choices.has(entry)) || new Set(value).size !== value.length) return 'selection';
    if (property.minItems !== undefined && value.length < property.minItems) return 'minItems';
    if (property.maxItems !== undefined && value.length > property.maxItems) return 'maxItems';
  }
  return undefined;
}
