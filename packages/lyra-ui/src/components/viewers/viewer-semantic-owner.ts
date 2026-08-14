import { hostAriaLabel } from '../../internal/a11y.js';

/**
 * Resolves the accessible name for a viewer's overall shadow semantic owner.
 *
 * A non-empty host `aria-label` already exposes the custom-element host as a named semantic
 * owner, so it must not be copied onto a second owner in shadow DOM. An explicitly empty host
 * label remains explicit on the shadow owner, while an absent label permits the component's
 * localized or property-derived fallback.
 */
export function viewerSemanticLabel(host: Element, fallback: string | null = null): string | null {
  const authored = hostAriaLabel(host);
  if (authored === null) return fallback;
  return authored === '' ? '' : null;
}

/** Omits a redundant shadow role when a non-empty host label owns the viewer semantics. */
export function viewerSemanticRole(host: Element, role: string): string | null {
  const authored = hostAriaLabel(host);
  return authored !== null && authored !== '' ? null : role;
}
