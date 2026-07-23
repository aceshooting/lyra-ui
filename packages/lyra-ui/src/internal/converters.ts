import type { ComplexAttributeConverter } from 'lit';

const trueUnlessLiteralFalse = (value: string | null): boolean => value !== 'false';

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

/** Spellcheck variant that keeps the default `true` value absent and serializes only `false`. */
export const trueDefaultSpellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
  toAttribute: (value): string | null => (value ? null : 'false'),
};

/** Parse-only spellcheck variant for non-reflected properties. */
export const spellcheckFromAttributeConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: trueUnlessLiteralFalse,
};
