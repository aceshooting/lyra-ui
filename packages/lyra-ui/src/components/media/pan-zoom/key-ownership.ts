function isElementTarget(target: EventTarget): target is Element {
  const candidate = target as Partial<Element> & { nodeType?: number };
  return candidate.nodeType === 1 && typeof candidate.matches === 'function';
}

/** Whether an editor, a composite widget or an `ownerTag` element on the event path owns the key. */
export function ownsKeyboardInput(event: KeyboardEvent, ownerTag?: string): boolean {
  for (const target of event.composedPath()) {
    if (!isElementTarget(target)) continue;
    if (target.localName === ownerTag || target.matches(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
      '[role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], ' +
      '[role="slider"], [role="listbox"], [role="menu"], [role="menuitem"], [role="radio"], ' +
      '[role="radiogroup"], [role="grid"], [role="tree"], [role="tablist"]',
    )) return true;
  }
  return false;
}
