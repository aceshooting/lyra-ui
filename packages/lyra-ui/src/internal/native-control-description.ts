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
      localIds = localDescriptionIds();
      project(target, localIds, resolveIdReferencesIn(nextRoot, describedBy));
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
    if (target && target !== nextTarget) project(target, localIds, []);
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
      target = null;
    },
  };
}
