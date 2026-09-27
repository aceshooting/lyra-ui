interface LitWarningGlobal {
  litIssuedWarnings?: Set<string>;
}

/**
 * Declares the exact English messages a locale-formatting or RTL fixture intentionally uses
 * without registering a translated catalog. Seed only those dedupe keys before mounting fixtures,
 * so unrelated localization warnings and all other strict-console diagnostics remain active.
 * Tests of the fallback warning itself must capture the warning instead of calling this helper.
 */
export function expectLocaleFallback(locale: string, keys: readonly string[]): void {
  const warnings = (globalThis as LitWarningGlobal).litIssuedWarnings;
  for (const key of keys) warnings?.add(`lyra-locale-fallback:${locale}:${key}`);
}
