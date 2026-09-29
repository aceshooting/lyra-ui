/**
 * Compatibility entry for the shared bounded composed accessibility-text traversal.
 *
 * The implementation lives with the visibility predicates it consumes so label, announcement,
 * typeahead and semantic-owner paths cannot drift into separate recursive walkers.
 */
import {
  composedAccessibilityTextResult,
  type ComposedAccessibilityTextOptions,
} from './accessibility-visibility.js';

export {
  composedAccessibilityText,
  composedAccessibilityTextResult,
} from './accessibility-visibility.js';

import { CustomElementUpgradeObserver } from './custom-element-upgrade-observer.js';

/** Collects announcement text and follows definitions that can introduce new shadow roots. */
export class AnnouncementUpgradeObserver extends CustomElementUpgradeObserver {
  collect(
    node: Node,
    roots: Set<ShadowRoot>,
    options: ComposedAccessibilityTextOptions = {},
  ): string {
    const result = composedAccessibilityTextResult(node, {
      ...options,
      shouldPrune: (element) => {
        if (options.shouldPrune?.(element)) return true;
        this.observeElement(element);
        return false;
      },
    });
    for (const root of result.traversedShadowRoots) roots.add(root);
    return result.text;
  }

}
