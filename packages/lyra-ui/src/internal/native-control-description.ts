import { resolveIdReferencesIn, updateDescriptionBaseline } from './aria-reflection.js';
import { asciiWhitespaceTokens } from './ascii-whitespace.js';

/** A component-owned description projection onto its current native semantic control. */
export interface NativeControlDescriptionLease {
  update(target: HTMLElement | null): void;
  release(): void;
}

/**
 * Projects host references before the local description IDs authored by a native-control wrapper.
 * Transient description owners remain coordinated through the shared baseline updater.
 */
export function acquireNativeControlDescription(
  host: HTMLElement,
  initialTarget: HTMLElement | null,
  localDescriptionIds: () => string,
): NativeControlDescriptionLease {
  let target: HTMLElement | null = null;
  let localIds = '';
  let active = true;
  let observer: MutationObserver | undefined;
  let ownerDocument: Document | undefined;
  let root: Node | undefined;
  let watchesRoot = false;
  // What the last projection wrote and resolved, so an unchanged refresh (one per owner render)
  // neither rewrites the relationship nor wakes its coordinated description owners. The target's
  // own state is re-read too: an owner template can re-commit its own `aria-describedby` onto it.
  let projected: {
    target: HTMLElement;
    ids: string;
    external: readonly Element[];
    local: readonly Element[];
    attribute: string | null;
    elements: readonly Element[] | null;
  } | undefined;

  const describedElements = (control: HTMLElement): readonly Element[] | null =>
    'ariaDescribedByElements' in control ? [...(control.ariaDescribedByElements ?? [])] : null;
  const sameElements = (first: readonly Element[] | null, second: readonly Element[] | null): boolean =>
    first === null || second === null
      ? first === second
      : first.length === second.length && first.every((element, index) => element === second[index]);

  const project = (control: HTMLElement, ids: string, external: readonly Element[]): void => {
    updateDescriptionBaseline(control, () => {
      if ('ariaDescribedByElements' in control) {
        if (external.length) {
          control.ariaDescribedByElements = [...new Set([
            ...external,
            ...resolveIdReferencesIn(control.getRootNode(), ids),
          ])];
          return;
        }
        control.ariaDescribedByElements = null;
      }
      if (ids) control.setAttribute('aria-describedby', ids);
      else control.removeAttribute('aria-describedby');
    });
  };

  const disconnect = (): void => {
    const previous = observer;
    observer = undefined;
    ownerDocument = undefined;
    root = undefined;
    try { previous?.disconnect(); } catch { /* The previous realm no longer owns this projection. */ }
  };

  const refresh = (): void => {
    if (!active) return;
    const nextRoot = host.getRootNode();
    const describedBy = host.getAttribute('aria-describedby');
    if (target) {
      const ids = localDescriptionIds();
      const external = resolveIdReferencesIn(nextRoot, describedBy);
      const local = resolveIdReferencesIn(target.getRootNode(), ids);
      if (
        !projected || projected.target !== target || projected.ids !== ids ||
        !sameElements(projected.external, external) || !sameElements(projected.local, local) ||
        target.getAttribute('aria-describedby') !== projected.attribute ||
        !sameElements(describedElements(target), projected.elements)
      ) {
        localIds = ids;
        project(target, ids, external);
        projected = {
          target,
          ids,
          external,
          local,
          attribute: target.getAttribute('aria-describedby'),
          elements: describedElements(target),
        };
      }
    }
    const nextDocument = host.ownerDocument;
    const nextWatchesRoot = nextRoot !== host && !asciiWhitespaceTokens(describedBy).next().done;
    if (observer && ownerDocument === nextDocument && root === nextRoot && watchesRoot === nextWatchesRoot) return;
    disconnect();
    try {
      const Observer = nextDocument.defaultView?.MutationObserver;
      if (!Observer) return;
      const nextObserver = new Observer(() => {
        if (active && observer === nextObserver) refresh();
      });
      observer = nextObserver;
      ownerDocument = nextDocument;
      root = nextRoot;
      watchesRoot = nextWatchesRoot;
      nextObserver.observe(host, { attributes: true, attributeFilter: ['aria-describedby'] });
      if (watchesRoot) nextObserver.observe(nextRoot, {
        attributes: true, attributeFilter: ['id'], childList: true, subtree: true,
      });
    } catch { disconnect(); }
  };

  const update = (nextTarget: HTMLElement | null): void => {
    if (!active) return;
    if (target && target !== nextTarget) {
      project(target, localIds, []);
      projected = undefined;
    }
    target = nextTarget;
    refresh();
  };
  update(initialTarget);
  return {
    update,
    release() {
      if (!active) return;
      active = false;
      disconnect();
      if (target) project(target, localIds, []);
      projected = undefined;
      target = null;
    },
  };
}
