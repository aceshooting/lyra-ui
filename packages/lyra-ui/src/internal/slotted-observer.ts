export interface DisconnectableObserver {
  disconnect(): void;
}

/** Resolves the element targets assigned to an observer wrapper's default slot. */
export function slottedElementTargets(renderRoot: ParentNode): Element[] {
  const slot = renderRoot.querySelector('slot');
  return slot?.assignedElements({ flatten: true }) ?? [];
}

/** Tears down an observer and returns `undefined` for atomic field reassignment. */
export function disconnectObserver<T extends DisconnectableObserver>(observer: T | undefined): undefined {
  observer?.disconnect();
  return undefined;
}

