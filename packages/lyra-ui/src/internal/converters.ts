import type { ComplexAttributeConverter } from 'lit';

const trueUnlessLiteralFalse = (value: string | null): boolean => value !== 'false';

/** Reflects non-empty strings while keeping the empty/default value absent from markup. */
export const omittedEmptyStringConverter: ComplexAttributeConverter<string> = {
  fromAttribute: (value) => value ?? '',
  toAttribute: (value) => value || null,
};

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
