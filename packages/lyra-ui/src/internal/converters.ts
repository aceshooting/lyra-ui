import type { ComplexAttributeConverter } from 'lit';

/** A closed-string-set converter that can also normalize direct JavaScript property writes. */
export interface LiteralSetConverter<T extends string> extends ComplexAttributeConverter<T> {
  /** Returns `value` when it belongs to the declared set, otherwise the configured fallback. */
  readonly normalize: (value: unknown) => T;
  /** Normalizes a reflected write and immediately repairs a foreign raw attribute value. */
  readonly normalizeReflected: (
    host: Element,
    attribute: string,
    value: unknown
  ) => T;
}

/**
 * Creates one fail-safe contract for a reflected closed string property.
 *
 * Lit applies converters to attribute reads and reflection, but not to direct property writes.
 * Components with a custom accessor therefore use the same object's `normalize()` method in the
 * setter, keeping markup and untyped JavaScript writes on one authoritative path.
 */
export function literalSetConverter<const T extends string>(
  values: readonly T[],
  fallback: T,
): LiteralSetConverter<T> {
  const allowed = new Set<T>(values);
  if (allowed.size !== values.length || !allowed.has(fallback)) {
    throw new TypeError('literalSetConverter requires unique values that include its fallback');
  }

  const normalize = (value: unknown): T =>
    typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;

  const normalizeReflected = (
    host: Element,
    attribute: string,
    value: unknown
  ): T => {
    const normalized = normalize(value);
    if (
      host.hasAttribute(attribute) &&
      host.getAttribute(attribute) !== normalized
    ) {
      host.setAttribute(attribute, normalized);
    }
    return normalized;
  };

  return Object.freeze({
    fromAttribute: normalize,
    toAttribute: normalize,
    normalize,
    normalizeReflected,
  });
}

const trueUnlessLiteralFalse = (value: string | null): boolean => value !== 'false';

/** Reflects non-empty strings while keeping the empty/default value absent from markup. */
export const omittedEmptyStringConverter: ComplexAttributeConverter<string> = {
  fromAttribute: (value) => value ?? '',
  toAttribute: (value) => value || null,
};

/**
 * Restores a declared string/number default when an attribute is removed while preserving the
 * component's established initial reflection. Lit's `useDefault` restores removal too, but it
 * intentionally omits the initial reflected attribute and therefore changes that DOM contract.
 */
export function declaredDefaultConverter<T extends string | number>(
  declaredDefault: T
): ComplexAttributeConverter<T> {
  return Object.freeze({
    fromAttribute: (value: string | null): T => {
      if (value === null) return declaredDefault;
      return (typeof declaredDefault === 'number' ? Number(value) : value) as T;
    },
    toAttribute: (value: T): string | number => value,
  });
}

/**
 * Converter for a reflected boolean whose default is `true`.
 *
 * The non-default `false` value is serialized explicitly so declarative markup can distinguish it
 * from the absent attribute while the default value stays absent from the DOM.
 */
export const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
  toAttribute: (value): string | null => (value ? null : 'false'),
};

/** Parse-only variant for a true-defaulting property that is not reflected. */
export const trueDefaultBooleanFromAttributeConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
};

/**
 * Presence-reflecting variant retained for properties whose established reflected contract uses
 * an empty attribute for `true` and no attribute for `false`.
 */
export const presenceTrueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
  toAttribute: (value): string | null => (value ? '' : null),
};

/** Native spellcheck serialization using the explicit `"true"` / `"false"` vocabulary. */
export const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
  toAttribute: (value): string => (value ? 'true' : 'false'),
};

/** Normalizes the combined Web Awesome boolean and Shoelace string write vocabularies. */
export const normalizeAutocorrect = (value: boolean | string | null): boolean =>
  value === null || (typeof value === 'string' ? value !== 'off' && value !== 'false' : Boolean(value));

/** Native/Web Awesome `autocorrect` IDL parsing: the property is boolean while the HTML
 * attribute uses the enumerated `"on"`/`"off"` vocabulary. */
export const autocorrectConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: normalizeAutocorrect,
  toAttribute: (value): string => (value ? 'on' : 'off'),
};

/** Spellcheck variant that keeps the default `true` value absent and serializes only `false`. */
export const trueDefaultSpellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
  toAttribute: (value): string | null => (value ? null : 'false'),
};

/** Parse-only spellcheck variant for non-reflected properties. */
export const spellcheckFromAttributeConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
};
