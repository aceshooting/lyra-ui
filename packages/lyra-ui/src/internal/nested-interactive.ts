/** Controls that keep an actionable card or linked statistic from owning a nested click. */
const NESTED_INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'audio[controls]',
  'video[controls]', 'label', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])', '[role="button"]', '[role="link"]',
  '[role="checkbox"]', '[role="switch"]', '[role="radio"]', '[role="menuitem"]',
  '[role="option"]', '[role="tab"]', '[role="textbox"]', '[role="slider"]',
  '[role="spinbutton"]',
].join(',');

/** Examine the composed path up to the interaction owner, including a slotted control's shadow. */
export function containsNestedInteractive(event: Event, root: EventTarget | null): boolean {
  for (const node of event.composedPath()) {
    if (node === root) return false;
    if (node && typeof (node as Element).matches === 'function' &&
        (node as Element).matches(NESTED_INTERACTIVE_SELECTOR)) return true;
  }
  return false;
}
