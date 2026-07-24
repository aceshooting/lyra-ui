function resolveIdReferences(host: HTMLElement, value: string | null): Element[] {
  if (!value) return [];
  const root = host.getRootNode();
  if (!('getElementById' in root)) return [];
  const getElementById = (root as Document | ShadowRoot).getElementById.bind(root);
  return value
    .trim()
    .split(/\s+/)
    .map((id) => getElementById(id) as Element | null)
    .filter((target): target is Element => target !== null);
}

/**
 * Keeps an internal semantic control's `ariaControlsElements` relationship aligned with an
 * `aria-controls` value observed on its custom-element host.
 *
 * String ID references on an element inside shadow DOM cannot resolve targets in that element's
 * parent tree. The reflected element-reference API can target a parent scope, so resolve the IDs
 * from the host's own root and assign the resulting elements directly when the browser supports
 * it. Per the reflected-element-reference contract, assigning the property clears the serialized
 * content attribute (`getAttribute('aria-controls') === ''`); the property remains the source of
 * truth and is what the browser maps into accessibility APIs. A string and an explicitly assigned
 * element-reference list cannot coexist. The caller still renders the string attribute on the
 * internal control as a fallback for browsers without the element-reference API.
 */
export function syncAriaControlsElements(
  host: HTMLElement,
  control: HTMLElement | undefined,
  controls: string | null,
): void {
  if (!control || !('ariaControlsElements' in control)) return;

  const reflected = control as HTMLElement & { ariaControlsElements: Element[] | null };
  if (!controls) {
    reflected.ariaControlsElements = [];
    return;
  }

  const targets = resolveIdReferences(host, controls);

  // Leave the string attribute in place when every reference is dangling. That preserves the
  // native fallback and lets a later host update retry after the target has mounted.
  if (targets.length > 0) reflected.ariaControlsElements = targets;
}

/**
 * Applies host-owned `aria-describedby` ID references to a focused native control across the
 * custom element's shadow boundary. Callers avoid invoking this for the initial empty state, so
 * ordinary buttons do not gain a meaningless empty `aria-describedby` attribute.
 */
export function syncAriaDescribedByElements(
  host: HTMLElement,
  control: HTMLElement | undefined,
  describedBy: string | null,
): boolean {
  if (!control || !('ariaDescribedByElements' in control)) return false;
  const targets = resolveIdReferences(host, describedBy);
  const reflected = control as HTMLElement & {
    ariaDescribedByElements: Element[] | null;
  };
  if (targets.length > 0) reflected.ariaDescribedByElements = targets;
  else if (!describedBy) reflected.ariaDescribedByElements = null;
  return targets.length > 0;
}
