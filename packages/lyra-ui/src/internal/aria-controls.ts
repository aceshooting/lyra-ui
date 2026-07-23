/**
 * Keeps an internal semantic control's `ariaControlsElements` relationship aligned with an
 * `aria-controls` value observed on its custom-element host.
 *
 * String ID references on an element inside shadow DOM cannot resolve targets in that element's
 * parent tree. The reflected element-reference API can target a parent scope, so resolve the IDs
 * from the host's own root and assign the resulting elements directly when the browser supports
 * it. The caller still renders the string attribute on the internal control as a fallback for
 * browsers without the element-reference API.
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

  const root = host.getRootNode();
  if (!('getElementById' in root)) return;
  const getElementById = (root as Document | ShadowRoot).getElementById.bind(root);
  const targets = controls
    .trim()
    .split(/\s+/)
    .map((id) => getElementById(id) as Element | null)
    .filter((target): target is Element => target !== null);

  // Leave the string attribute in place when every reference is dangling. That preserves the
  // native fallback and lets a later host update retry after the target has mounted.
  if (targets.length > 0) reflected.ariaControlsElements = targets;
}
