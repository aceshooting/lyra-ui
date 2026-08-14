import { hostAriaLabel } from "../../internal/a11y.js";

/**
 * Resolves the name for a retrieval component's overall shadow semantic shell.
 *
 * A non-empty host `aria-label` already exposes the custom-element host as the named owner, so it
 * must not be cloned onto (or accompanied by a fallback name on) a second overall owner in shadow
 * DOM. An explicitly empty host label remains explicit on the shadow shell, while an absent label
 * permits the component's localized/property-derived fallback.
 */
export function retrievalSemanticLabel(
  host: Element,
  fallback: string | null = null
): string | null {
  const authored = hostAriaLabel(host);
  if (authored === null) return fallback;
  return authored === "" ? "" : null;
}

/** Omits a redundant overall shadow role when a non-empty host label owns the component. */
export function retrievalSemanticRole(
  host: Element,
  role: string
): string | null {
  const authored = hostAriaLabel(host);
  return authored !== null && authored !== "" ? null : role;
}
