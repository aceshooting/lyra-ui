/** Attributes that can change inherited theme inputs without replacing a stylesheet. */
export const THEME_ATTRIBUTES = [
  'class',
  'style',
  'data-lr-theme',
  'data-lr-mode',
  'data-lr-look',
  'data-lr-surface',
  'data-lr-density',
  'data-lr-accent',
  'data-lr-theme-scope',
  'data-theme',
  'data-color-scheme',
] as const;

/** Inherited custom properties follow a distributed node's slot and a shadow root's host. */
export function flattenedThemeParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot).host : null;
}
