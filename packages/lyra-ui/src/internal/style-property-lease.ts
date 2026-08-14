export interface InlineStylePropertyLease {
  /** Replaces the temporary value while retaining the latest external value for release. */
  set(value: string, priority?: string): void;
  /** Restores the latest value written outside the lease. Idempotent. */
  release(): void;
}

interface InlineStyleValue {
  value: string;
  priority: string;
}

export type InlineStylePropertyResolver = (
  externalValue: string,
  externalPriority: string,
) => { value: string; priority?: string };

function readProperty(element: HTMLElement, property: string): InlineStyleValue {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function sameProperty(left: InlineStyleValue, right: InlineStyleValue): boolean {
  return left.value === right.value && left.priority === right.priority;
}

function writeProperty(element: HTMLElement, property: string, next: InlineStyleValue): void {
  // WebKit retains an existing `!important` custom-property declaration when setProperty()
  // replaces it with an empty priority. Removing first makes value and priority replacement exact
  // across engines; the observer is disconnected around lease-owned writes, so this cannot be
  // mistaken for a competing external declaration.
  element.style.removeProperty(property);
  if (next.value) element.style.setProperty(property, next.value, next.priority);
}

/**
 * Temporarily owns one inline declaration without losing a value written by another owner while
 * the lease is active. The temporary value is promptly reasserted; release restores the latest
 * external value and priority rather than a stale activation-time snapshot.
 */
export function leaseInlineStyleProperty(
  element: HTMLElement,
  property: string,
  value: string,
  priority = '',
  resolveOwned?: InlineStylePropertyResolver,
): InlineStylePropertyLease {
  let external = readProperty(element, property);
  let owned = { value, priority };
  let released = false;
  const MutationObserverConstructor =
    element.ownerDocument.defaultView?.MutationObserver ??
    (typeof globalThis.MutationObserver === 'function' ? globalThis.MutationObserver : undefined);
  let observer: MutationObserver | undefined;

  const observe = (): void => {
    observer?.observe(element, { attributeFilter: ['style'], attributes: true });
  };
  const applyOwned = (): void => {
    observer?.disconnect();
    writeProperty(element, property, owned);
    observe();
  };
  const captureExternal = (): void => {
    const current = readProperty(element, property);
    if (!sameProperty(current, owned)) external = current;
  };

  if (MutationObserverConstructor) {
    observer = new MutationObserverConstructor(() => {
      if (released) return;
      const current = readProperty(element, property);
      if (sameProperty(current, owned)) return;
      external = current;
      const resolved = resolveOwned?.(external.value, external.priority);
      if (resolved) owned = { value: resolved.value, priority: resolved.priority ?? '' };
      applyOwned();
    });
  }
  applyOwned();

  return {
    set(nextValue, nextPriority = '') {
      if (released) return;
      captureExternal();
      owned = { value: nextValue, priority: nextPriority };
      applyOwned();
    },
    release() {
      if (released) return;
      captureExternal();
      released = true;
      observer?.disconnect();
      observer = undefined;
      writeProperty(element, property, external);
    },
  };
}
