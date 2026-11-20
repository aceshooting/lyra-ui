/** Content that owns its own clicks and keys, so a row, cell, card, item or tile wrapping it must
 *  not reinterpret them as its own activation, selection or drag. One vocabulary for every owner. */
export const NESTED_INTERACTIVE_SELECTOR = [
  'a[href]', 'area[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label',
  'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])', '[role="button"]', '[role="link"]', '[role="checkbox"]',
  '[role="combobox"]', '[role="listbox"]', '[role="menu"]', '[role="menuitem"]', '[role="option"]',
  '[role="radio"]', '[role="separator"]', '[role="slider"]', '[role="spinbutton"]',
  '[role="switch"]', '[role="tab"]', '[role="textbox"]',
].join(',');

/** The first nested interactive element on `event`'s composed path before the first target that
 *  `isBoundary` accepts, so controls inside open shadow roots count too. */
export function nestedInteractiveTarget(
  event: Event,
  isBoundary: (target: EventTarget) => boolean,
): Element | null {
  for (const target of event.composedPath()) {
    if (isBoundary(target)) return null;
    const element = target as Partial<Element>;
    if (element.nodeType === 1 && typeof element.matches === 'function' &&
        element.matches(NESTED_INTERACTIVE_SELECTOR)) return target as Element;
  }
  return null;
}

/** Examine the composed path up to the interaction owner, including a slotted control's shadow. */
export function containsNestedInteractive(event: Event, root: EventTarget | null): boolean {
  return nestedInteractiveTarget(event, (target) => target === root) !== null;
}
