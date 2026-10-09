export { devWarn, devWarnOnce, deprecationWarningKey, warnDeprecatedUsage, type LyraDeprecatedUsageKind } from './dev-warning.js';

/** Production entry: unknown-attribute diagnostics are available in the development condition. */
export function warnUnknownAttributes(
  _host: Element,
  _observedAttributes: readonly string[] = [],
  _knownUnobservedAttributes: readonly string[] = []
): void {}
