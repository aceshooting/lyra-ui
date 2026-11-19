import { hostAriaLabel } from './a11y.js';

/** A caller-supplied label as usable text: trimmed, with blank, whitespace-only and non-string
 *  values treated as absent (`undefined`), so no caller ever renders `aria-label=""`. */
export function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** The accessible name for a control: the host's authored `aria-label` (including the public
 *  `accessibleLabel` binding) wins, then the first candidate that normalizes to real text.
 *  Pass the localized default last. `undefined` means nothing supplied a name, so the caller
 *  should omit `aria-label` instead of writing an empty one. */
export function resolveAccessibleName(host: HTMLElement, ...candidates: unknown[]): string | undefined {
  const authored = normalizeLabel(hostAriaLabel(host));
  if (authored !== undefined) return authored;
  for (const candidate of candidates) {
    const label = normalizeLabel(candidate);
    if (label !== undefined) return label;
  }
  return undefined;
}

/** An accessible name that always starts with the visible text (label in name) and appends the
 *  optional, already-localized context after it. A blank visible text yields the context alone. */
export function labelWithVisibleText(visible: string, context?: string): string {
  const text = normalizeLabel(visible) ?? '';
  const extra = normalizeLabel(context) ?? '';
  return text && extra ? `${text} ${extra}` : text || extra;
}
