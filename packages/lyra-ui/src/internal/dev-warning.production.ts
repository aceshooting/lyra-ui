import type { LyraDeprecatedUsageKind } from './dev-warning.development.js';
export type { LyraDeprecatedUsageKind } from './dev-warning.development.js';

/** Production diagnostics retain call compatibility without allocating warning state. */
export function litDevWarnings(): Set<string> | undefined { return undefined; }
export function devWarn(_message: string): void {}
export function devWarnOnce(_key: string, _message: string): void {}
export function warnLocaleFallback(_locale: string, _key: string): void {}
export function warnDeprecatedUsage(
  _host: Element | string,
  _kind: LyraDeprecatedUsageKind,
  _name: string,
  _replacement: string
): void {}
export function deprecationWarningKey(tagName: string, kind: LyraDeprecatedUsageKind, name: string): string {
  return `lyra-deprecated:${tagName}:${kind}:${name}`;
}
