import { asciiWhitespaceTokens } from './ascii-whitespace.js';
import { highestReachableWindow } from './a11y.js';

export function resolveIdReferencesIn(root: Node, value: string | null): Element[] {
  if (!value || !('getElementById' in root)) return [];
  const getElementById = (root as Document | ShadowRoot).getElementById.bind(root);
  const references: Element[] = [];
  const seen = new Set<Element>();
  for (const id of asciiWhitespaceTokens(value)) {
    const target = getElementById(id);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    references.push(target);
  }
  return references;
}

function resolveIdReferences(host: HTMLElement, value: string | null): Element[] {
  return resolveIdReferencesIn(host.getRootNode(), value);
}

type DescriptionBaselineUpdater = (target: HTMLElement, update: () => void) => void;
const DESCRIPTION_BASELINE_UPDATER = Symbol.for(
  '@aceshooting/lyra-ui.aria-description-baseline-updater.v1',
);
type DescriptionBaselineUpdaterHost = typeof globalThis & {
  [DESCRIPTION_BASELINE_UPDATER]?: DescriptionBaselineUpdater;
};

function updaterHost(ownerWindow: Window | null): DescriptionBaselineUpdaterHost {
  return (ownerWindow ? highestReachableWindow(ownerWindow) : globalThis) as DescriptionBaselineUpdaterHost;
}

/** @internal Installs ownership-aware coordination only when description leases are in the graph. */
export function registerDescriptionBaselineUpdater(updater: DescriptionBaselineUpdater): void {
  const ownerWindow = typeof window === 'undefined' ? null : window;
  updaterHost(ownerWindow)[DESCRIPTION_BASELINE_UPDATER] = updater;
}

function updateDescriptionBaseline(target: HTMLElement, update: () => void): void {
  const updater = updaterHost(target.ownerDocument.defaultView)[DESCRIPTION_BASELINE_UPDATER];
  if (updater) updater(target, update);
  else update();
}

/** Reflects a host's `aria-controls` relationship onto its shadow semantic control. */
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
  if (targets.length > 0) reflected.ariaControlsElements = targets;
}

/** Reflects a host's `aria-describedby` relationship onto its shadow semantic control. */
export function syncAriaDescribedByElements(
  host: HTMLElement,
  control: HTMLElement | undefined,
  describedBy: string | null,
): boolean {
  if (!control || !('ariaDescribedByElements' in control)) return false;
  const targets = resolveIdReferences(host, describedBy);
  const reflected = control as HTMLElement & { ariaDescribedByElements: Element[] | null };
  updateDescriptionBaseline(control, () => {
    if (targets.length > 0) reflected.ariaDescribedByElements = targets;
    else if (!describedBy) reflected.ariaDescribedByElements = null;
  });
  return targets.length > 0;
}
