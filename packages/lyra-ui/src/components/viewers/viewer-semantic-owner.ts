import { hostAriaLabel } from '../../internal/a11y.js';
import { normalizeLabel } from '../../internal/accessible-name.js';
import { attachInternalsSafely } from '../../internal/element-internals.js';

// Viewers attach no other internals, so the semantic owner attaches them lazily on first use.
const hostInternals = new WeakMap<HTMLElement, ElementInternals>();

/** Whether a non-empty host `aria-label` (or `accessibleLabel`) names the viewer itself. */
export function viewerHostOwnsName(host: Element): boolean {
  return normalizeLabel(hostAriaLabel(host)) !== undefined;
}

/**
 * Resolves the accessible name for a viewer's overall shadow semantic owner.
 *
 * A non-empty host `aria-label` names the custom-element host, which {@link viewerSemanticRole}
 * gives the viewer role, so the name is never copied onto a second owner in shadow DOM. An
 * explicitly empty host label remains explicit on the shadow owner, while an absent label permits
 * the component's localized or property-derived fallback; a whitespace-only fallback counts as
 * absent, while an explicitly empty one is kept.
 */
export function viewerSemanticLabel(host: Element, fallback: string | null = null): string | null {
  const authored = hostAriaLabel(host);
  if (authored === null) return fallback === '' ? '' : normalizeLabel(fallback) ?? null;
  return authored === '' ? '' : null;
}

/**
 * Places the viewer's overall role on exactly one owner and returns the role for the shadow
 * owner. With a non-empty host label the host takes `role` through `ElementInternals` (an author
 * `role` attribute still wins) and the shadow owner gets none; otherwise the host stays generic
 * and the shadow owner carries `role`. Call it on every render, passing `null` while the current
 * state exposes no overall owner, so the host role never outlives the state that set it.
 */
export function viewerSemanticRole(host: HTMLElement, role: string | null): string | null {
  const ownsName = viewerHostOwnsName(host);
  let internals = hostInternals.get(host);
  if (!internals && ownsName) {
    internals = attachInternalsSafely(host);
    hostInternals.set(host, internals);
  }
  if (internals) internals.role = ownsName ? role : null;
  return ownsName ? null : role;
}

/** @internal The role {@link viewerSemanticRole} last gave the host through `ElementInternals`. */
export function viewerHostRole(host: HTMLElement): string | null {
  return hostInternals.get(host)?.role ?? null;
}
