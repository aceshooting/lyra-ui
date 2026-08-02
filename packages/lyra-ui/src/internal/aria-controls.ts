function resolveIdReferencesIn(root: Node, value: string | null): Element[] {
  if (!value) return [];
  if (!('getElementById' in root)) return [];
  const getElementById = (root as Document | ShadowRoot).getElementById.bind(root);
  return value
    .trim()
    .split(/\s+/)
    .map((id) => getElementById(id) as Element | null)
    .filter((target): target is Element => target !== null);
}

function resolveIdReferences(host: HTMLElement, value: string | null): Element[] {
  return resolveIdReferencesIn(host.getRootNode(), value);
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

/** What a described element looked like before a transient description was applied to it. */
export interface AppliedDescription {
  readonly target: HTMLElement;
  readonly had: boolean;
  readonly value: string | null;
  /** Whether the element-reference list (rather than the serialized attribute) carries the link. */
  readonly assigned: boolean;
}

type DescribedByElementsTarget = HTMLElement & { ariaDescribedByElements: Element[] | null };

/** The description relationships already on `target`, read the way the browser resolves them: an
 *  explicitly assigned element-reference list wins, otherwise the serialized IDs are resolved
 *  inside the target's own root (a shadow root for an internal control). */
function existingDescriptions(target: HTMLElement, value: string | null): Element[] {
  const reflected =
    'ariaDescribedByElements' in target ? (target as DescribedByElementsTarget).ariaDescribedByElements : null;
  return reflected ? [...reflected] : resolveIdReferencesIn(target.getRootNode(), value);
}

/**
 * Adds `description` to whatever already describes `target`, and returns the snapshot
 * `undescribeElement()` needs to put it back.
 *
 * An ID reference only resolves inside the referring node's own root, so a description element
 * living in one tree cannot be pointed at from a control inside a shadow root. The reflected
 * `ariaDescribedByElements` property carries an element reference across that boundary, so prefer
 * it whenever the browser exposes it -- feature-detected, because it only reaches the platform
 * gradually. The serialized attribute is still written first: it is the whole relationship on
 * browsers without the property, and assigning the property afterwards clears it
 * (`getAttribute('aria-describedby') === ''`) exactly as the reflected-element contract specifies.
 * Existing relationships are carried into the assigned list rather than replaced -- a control such
 * as `<lr-select>`'s internal trigger already points at its own hint and error text, and dropping
 * those to add a tooltip would trade one lost description for another.
 */
export function describeElement(target: HTMLElement, description: Element): AppliedDescription {
  const value = target.getAttribute('aria-describedby');
  const snapshot = { target, had: target.hasAttribute('aria-describedby'), value };
  const existing = existingDescriptions(target, value);
  if (existing.includes(description)) return { ...snapshot, assigned: false };

  const root = target.getRootNode() as Document | ShadowRoot;
  const resolvableById = description.id !== '' && root.getElementById?.(description.id) === description;
  const ids = new Set((value ?? '').split(/\s+/).filter(Boolean));
  if (description.id !== '') ids.add(description.id);
  if (ids.size > 0) target.setAttribute('aria-describedby', [...ids].join(' '));

  // Same-root targets are fully served by the attribute; leave the reflected list untouched there
  // so the serialized relationship stays inspectable (and consumer-overridable) as before.
  if (resolvableById || !('ariaDescribedByElements' in target)) return { ...snapshot, assigned: false };
  (target as DescribedByElementsTarget).ariaDescribedByElements = [...existing, description];
  return { ...snapshot, assigned: true };
}

/** Reverts `describeElement()`, restoring both the element-reference list and the attribute. */
export function undescribeElement(applied: AppliedDescription): void {
  const { target, had, value, assigned } = applied;
  if (assigned && 'ariaDescribedByElements' in target) {
    (target as DescribedByElementsTarget).ariaDescribedByElements = null;
  }
  if (had) target.setAttribute('aria-describedby', value ?? '');
  else target.removeAttribute('aria-describedby');
}
