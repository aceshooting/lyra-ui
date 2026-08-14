import { hostAriaLabel } from '../../internal/a11y.js';

/**
 * Resolves an overall shadow wrapper without cloning a non-empty host name onto a second semantic
 * owner. An absent host label uses the component fallback; an explicitly empty one remains empty.
 */
export function overallSemanticLabel(host: Element, fallback: string | null = null): string | null {
  const label = hostAriaLabel(host);
  if (label === null) return fallback;
  return label === '' ? '' : null;
}

/** Omits a redundant overall wrapper role when a non-empty host label already owns the name. */
export function overallSemanticRole(host: Element, role: string): string | null {
  const label = hostAriaLabel(host);
  return label !== null && label !== '' ? null : role;
}

/**
 * Names a nested interactive owner by purpose instead of cloning the host's overall name. Only a
 * genuinely decoratable primary media/frame opts into preserving an explicit empty host label.
 */
export function purposeAccessibleLabel(
  host: Element,
  fallback: string,
  options: { allowExplicitEmpty?: boolean } = {},
): string {
  return options.allowExplicitEmpty && hostAriaLabel(host) === '' ? '' : fallback;
}
