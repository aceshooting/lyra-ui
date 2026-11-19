/**
 * Native ranges can step even when an arrow key has modifiers. Leave the key
 * event available and suppress any synchronous range events from its default action.
 */
export function preserveRangeKeyboardShortcut(event: KeyboardEvent): void {
  if (!event.isTrusted || event.defaultPrevented) return;
  const range = event.currentTarget as HTMLInputElement;
  const value = range.value;
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  const stop = () => controller.abort();
  range.addEventListener('pointerdown', stop, options);
  range.addEventListener('keydown', stop, options);
  range.addEventListener('input', input => {
    if (!input.isTrusted) return;
    range.value = value;
    input.stopImmediatePropagation();
    range.addEventListener('change', change => {
      if (!change.isTrusted) return;
      change.stopImmediatePropagation();
      stop();
    }, options);
  }, options);
  setTimeout(stop, 0);
}
