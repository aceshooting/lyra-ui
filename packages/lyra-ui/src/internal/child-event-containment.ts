/** Events raised by a builder's own shadow controls, separate from slotted consumer content. */
export const BUILDER_CHILD_EVENTS = Object.freeze([
  'input', 'change', 'lr-input', 'lr-change', 'lr-activate', 'lr-show', 'lr-after-show',
  'lr-hide', 'lr-after-hide', 'lr-clear', 'lr-filter', 'lr-invalid',
]);

/** Prevent an owned control's event from looking like a host event on an ancestor. */
export function containShadowChildEvent(event: Event): void {
  const target = event.target;
  if (target && typeof (target as Node).getRootNode === 'function' &&
      (target as Node).getRootNode() === event.currentTarget) event.stopPropagation();
}
