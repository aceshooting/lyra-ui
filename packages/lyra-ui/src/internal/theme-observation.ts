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
  'data-lr-accent-neutral',
  'data-lr-accent-success',
  'data-lr-accent-warning',
  'data-lr-accent-danger',
  'data-lr-theme-scope',
  'data-lr-contrast',
  'data-lr-motion',
  'data-lr-design-token-mode',
  'data-theme',
  'data-color-scheme',
] as const;

/** Inherited custom properties follow a distributed node's slot and a shadow root's host. */
export { flattenedParentElement as flattenedThemeParent } from './composed-tree.js';
