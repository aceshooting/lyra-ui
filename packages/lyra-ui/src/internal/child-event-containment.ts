/** Events raised by a builder's own shadow controls, separate from slotted consumer content. */
export const BUILDER_CHILD_EVENTS = Object.freeze([
  'input', 'change', 'lr-input', 'lr-change', 'lr-activate', 'lr-show', 'lr-after-show',
  'lr-hide', 'lr-after-hide', 'lr-clear', 'lr-filter', 'lr-invalid',
]);

/** Request, creation and diagnostic events of the picker controls a builder renders internally. */
export const OWNED_CONTROL_EVENTS = Object.freeze([
  'lr-change-request', 'lr-create', 'lr-retry-request', 'lr-source-error', 'lr-chip-change', 'lr-overflow-toggle',
]);

/** Prevent an owned control's event from looking like a host event on an ancestor. */
export function containShadowChildEvent(event: Event): void {
  const target = event.target;
  if (target && typeof (target as Node).getRootNode === 'function' &&
      (target as Node).getRootNode() === event.currentTarget) event.stopPropagation();
}

/** Contains each of `types` raised by controls inside `root`; returns the function that undoes it. */
export function containShadowChildEvents(root: EventTarget, types: readonly string[]): () => void {
  for (const type of types) root.addEventListener(type, containShadowChildEvent);
  return () => {
    for (const type of types) root.removeEventListener(type, containShadowChildEvent);
  };
}
