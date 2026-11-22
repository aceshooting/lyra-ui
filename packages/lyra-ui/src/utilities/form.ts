/**
 * Serializes a form to a plain object. A name that occurs once maps to its value (a string or a
 * `File`); a name that occurs more than once maps to an array of every value in document order.
 * Only successful controls take part, exactly as `new FormData(form)` decides.
 */
export function serialize(form: HTMLFormElement): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  return serializeFormData(new FormData(form));
}

/** The pure core of {@link serialize}: folds any `FormData` into a plain object. Keys are stored
 *  as own data properties, so a field named `__proto__` cannot change the result's prototype. */
export function serializeFormData(
  formData: FormData,
): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = Object.create(null) as Record<
    string,
    FormDataEntryValue | FormDataEntryValue[]
  >;
  formData.forEach((value, key) => {
    if (Object.hasOwn(result, key)) {
      const existing = result[key]!;
      if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    } else {
      result[key] = value;
    }
  });
  return result;
}
