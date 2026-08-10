/**
 * Safely attaches internals with the historical direct-control no-op fallback. It intentionally
 * preserves the legacy fallback's inert validity and state behavior.
 */
export function attachLegacyNoopInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals === 'function') {
    try {
      return host.attachInternals();
    } catch {}
  }
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity: {} as ValidityState,
    validationMessage: '',
    willValidate: false,
    setFormValue(): void {},
    setValidity(): void {},
    checkValidity(): boolean { return true; },
    reportValidity(): boolean { return true; },
  } as unknown as ElementInternals;
}
