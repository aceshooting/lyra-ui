/**
 * Compatibility entry for the shared bounded composed accessibility-text traversal.
 *
 * The implementation lives with the visibility predicates it consumes so label, announcement,
 * typeahead and semantic-owner paths cannot drift into separate recursive walkers.
 */
export {
  composedAccessibilityText,
  composedAccessibilityTextResult,
} from './accessibility-visibility.js';
