import { collectComposedFocusTargets } from './focus-navigation.js';

/** Resolves a trigger to its first programmatic focus target across shadow roots and slots.
 * A native control or explicitly focusable host owns its own accessible description. */
export function resolveAccessibleTrigger(trigger: HTMLElement): HTMLElement {
  if (trigger.hasAttribute('tabindex') || trigger.tabIndex >= 0) return trigger;
  const [focusable] = collectComposedFocusTargets(trigger, {
    includeRoot: false,
    mode: 'programmatic',
  }).elements;
  return focusable ?? trigger;
}
