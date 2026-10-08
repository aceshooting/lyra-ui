/** Cancels a deferred focus return when the user claims focus elsewhere. */
export function trackDeferredFocusReturn(doc: Document, onCancel: () => void): { readonly cancelled: boolean; cancel(): void } {
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    doc.removeEventListener('focusin', cancel, true);
    doc.removeEventListener('pointerdown', cancel, true);
    onCancel();
  };
  doc.addEventListener('focusin', cancel, true);
  doc.addEventListener('pointerdown', cancel, true);
  return { get cancelled() { return cancelled; }, cancel };
}

/** After `hidden` settles, runs `restore` only when the user has not claimed focus and `unchanged()` still holds. */
export function returnFocusAfterHide(
  hidden: Promise<unknown>,
  focus: { readonly cancelled: boolean; cancel(): void },
  unchanged: () => boolean,
  restore: () => void,
): void {
  void hidden.then(() => {
    const shouldFocus = !focus.cancelled && unchanged();
    focus.cancel();
    if (shouldFocus) restore();
  }, focus.cancel);
}
