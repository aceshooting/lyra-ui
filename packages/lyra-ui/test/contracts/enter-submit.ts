/** Dispatches the cancellable composed Enter event used by implicit-submit contracts. */
export function dispatchEnterKey(target: HTMLElement, init: KeyboardEventInit = {}): boolean {
  return target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    })
  );
}

/** Waits for a dispatched Enter keydown's post-propagation submission decision. */
export function settleEnterSubmission(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Dispatches Enter and waits for its post-propagation submission decision. */
export async function dispatchEnterKeyAndSettle(
  target: HTMLElement,
  init: KeyboardEventInit = {},
): Promise<boolean> {
  const accepted = dispatchEnterKey(target, init);
  await settleEnterSubmission();
  return accepted;
}
