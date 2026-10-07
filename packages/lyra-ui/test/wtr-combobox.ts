import { aTimeout } from '@open-wc/testing';

/** Runs the pending debounced `source` call now instead of sleeping out its default delay. */
export async function settleComboboxSource(el: HTMLElement & { updateComplete: Promise<unknown> }): Promise<void> {
  (el as unknown as { sourceDebounce: { flush(): void } }).sourceDebounce.flush();
  await aTimeout(0);
  await el.updateComplete;
}
