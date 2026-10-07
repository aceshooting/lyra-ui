import { isPlainDataRecord as isPlainRecord } from '../../../internal/data-descriptors.js';
import { snapshotStructuredData } from '../../../internal/structured-snapshot.js';
import type { FlatToolParamSchema, ToolParamFormProperty, ToolParamFormValue } from './tool-param-types.js';

export const MAX_SCHEMA_FIELDS = 100;
export const MAX_ENUM_OPTIONS = 500;
/** Values use the shared descriptor walker with the form's JSON-only, depth-16 profile. */
export function snapshotFormValue(value: unknown): {
  readonly value: ToolParamFormValue;
  readonly invalid: boolean;
  readonly truncated: boolean;
} {
  if (value == null) return { value: Object.freeze({}), invalid: false, truncated: false };
  const snapshot = snapshotStructuredData(value, {
    profile: 'form',
    structure: { shape: 'record', depth: 0 },
  });
  return { ...snapshot, value: (snapshot.value ?? Object.freeze({})) as ToolParamFormValue };
}

export interface SchemaSnapshot {
  readonly schema: FlatToolParamSchema;
  readonly shapeError: 'object' | 'properties' | '';
  readonly exceededLimits: boolean;
}

export const EMPTY_SCHEMA: FlatToolParamSchema = Object.freeze({
  type: 'object',
  properties: Object.freeze({}),
});

function snapshotSchemaStringArray(value: unknown): {
  readonly value?: readonly string[];
  readonly isArray: boolean;
  readonly malformed: boolean;
  readonly exceededLimit: boolean;
} {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { isArray: false, malformed: true, exceededLimit: false };
  }
  if (!isArray) return { isArray: false, malformed: true, exceededLimit: false };

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
    } else return { isArray: true, value: Object.freeze([]), malformed: true, exceededLimit: false };
  } catch {
    return { isArray: true, value: Object.freeze([]), malformed: true, exceededLimit: false };
  }

  const output: string[] = [];
  let malformed = false;
  for (let index = 0; index < Math.min(sourceLength, MAX_SCHEMA_FIELDS); index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      malformed = true;
      continue;
    }
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') {
      output.push(descriptor.value);
    } else malformed = true;
  }
  return {
    isArray: true,
    malformed,
    value: Object.freeze(output),
    exceededLimit: sourceLength > MAX_SCHEMA_FIELDS,
  };
}

interface SchemaEnumSnapshot {
  readonly value?: readonly string[];
  readonly malformed: boolean;
  readonly exceededLimit: boolean;
}

function snapshotSchemaEnum(value: unknown): SchemaEnumSnapshot {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { malformed: true, exceededLimit: false };
  }
  if (!isArray) return { malformed: true, exceededLimit: false };

  let sourceLength = 0;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      !descriptor
      || !('value' in descriptor)
      || typeof descriptor.value !== 'number'
      || !Number.isSafeInteger(descriptor.value)
      || descriptor.value < 0
    ) {
      return { malformed: true, exceededLimit: false };
    }
    sourceLength = descriptor.value;
  } catch {
    return { malformed: true, exceededLimit: false };
  }

  const output: string[] = [];
  for (let index = 0; index < Math.min(sourceLength, MAX_ENUM_OPTIONS); index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return { malformed: true, exceededLimit: sourceLength > MAX_ENUM_OPTIONS };
    }
    if (!descriptor) continue;
    if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
      return { malformed: true, exceededLimit: sourceLength > MAX_ENUM_OPTIONS };
    }
    output.push(descriptor.value);
  }
  return {
    value: Object.freeze(output),
    malformed: false,
    exceededLimit: sourceLength > MAX_ENUM_OPTIONS,
  };
}

function snapshotSchemaProperty(value: object): {
  readonly value?: ToolParamFormProperty;
  readonly malformed: boolean;
  readonly exceededLimit: boolean;
} {
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return { malformed: true, exceededLimit: false };
  }

  const withoutEnum: Record<PropertyKey, unknown> = {};
  let enumDescriptor: PropertyDescriptor | undefined;
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key as keyof PropertyDescriptorMap];
    if (!descriptor?.enumerable) continue;
    if (key === 'enum') {
      enumDescriptor = descriptor;
      continue;
    }
    if (!('value' in descriptor)) return { malformed: true, exceededLimit: false };
    Object.defineProperty(withoutEnum, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  const propertySnapshot = snapshotFormValue(withoutEnum);
  if (propertySnapshot.invalid || propertySnapshot.truncated) {
    return { malformed: true, exceededLimit: false };
  }

  let choices: readonly string[] | undefined;
  let exceededLimit = false;
  let hasEnum = false;
  if (enumDescriptor) {
    if (!('value' in enumDescriptor)) return { malformed: true, exceededLimit: false };
    hasEnum = true;
    if (enumDescriptor.value !== undefined) {
      const enumSnapshot = snapshotSchemaEnum(enumDescriptor.value);
      if (enumSnapshot.malformed) {
        return { malformed: true, exceededLimit: enumSnapshot.exceededLimit };
      }
      choices = enumSnapshot.value;
      exceededLimit = enumSnapshot.exceededLimit;
    }
  }

  const output: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(propertySnapshot.value)) {
    const descriptor = Object.getOwnPropertyDescriptor(propertySnapshot.value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) continue;
    Object.defineProperty(output, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  if (hasEnum) {
    Object.defineProperty(output, 'enum', {
      value: choices,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return {
    value: Object.freeze(output) as unknown as ToolParamFormProperty,
    malformed: false,
    exceededLimit,
  };
}

export function snapshotSchema(value: unknown): SchemaSnapshot {
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
    const propertySnapshot = snapshotSchemaProperty(descriptor.value);
    if (propertySnapshot.malformed || !propertySnapshot.value) {
      shapeError = 'properties';
      if (propertySnapshot.exceededLimit) exceededLimits = true;
      continue;
    }
    if (propertySnapshot.exceededLimit) exceededLimits = true;
    properties[key] = propertySnapshot.value;
  }

  const requiredDescriptor = rootDescriptors['required'];
  let required: readonly string[] | undefined;
  if (requiredDescriptor && 'value' in requiredDescriptor) {
    const requiredSnapshot = snapshotSchemaStringArray(requiredDescriptor.value);
    if (requiredSnapshot.malformed) shapeError = 'properties';
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

