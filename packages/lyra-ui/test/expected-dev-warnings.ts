interface LitWarningGlobal {
  litIssuedWarnings?: Set<string>;
}

/**
 * Seeds one exact page-wide `devWarnOnce()` key for a fixture that deliberately exercises the
 * corresponding fallback. This narrows only that warning; every other strict-console diagnostic
 * remains active. Tests whose subject is the warning itself should capture and assert it instead.
 */
export function expectDevWarning(key: string): void {
  (globalThis as LitWarningGlobal).litIssuedWarnings?.add(key);
}
