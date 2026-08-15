/**
 * Catalog keys conservatively discovered through a component's complete runtime import graph but
 * not resolved by that component at runtime.
 *
 * The generator validates every entry before applying it: keys stay sorted and unique, must exist
 * in DEFAULT_STRINGS, must still be present in the conservative result, and must not be reachable
 * through a literal or closed dynamic localize()/resolveLyraString() flow in the owning class. A
 * stale entry therefore fails closed instead of silently becoming permanent configuration.
 */
export const DEFAULT_STRING_SLICE_EXCLUSIONS = Object.freeze({
  // A local dynamic segment-key map makes the conservative fallback inspect transitive helpers.
  // These generic catalog-shaped literals come from those helpers, not from time-input lookups.
  'src/components/forms/input/time-input.class.ts': Object.freeze([
    'collapse',
    'date',
    'details',
    'map',
    'navigation',
    'open',
    'progress',
    'restore',
    'search',
    'select',
  ]),

  // These controls import non-mixin helpers from form-associated.ts. Its unrelated FormAssociated
  // export owns the fieldRequired lookup; none of these classes invokes that export.
  'src/components/forms/radio/radio-button.class.ts': Object.freeze(['fieldRequired']),
  'src/components/forms/radio/radio-group.class.ts': Object.freeze(['fieldRequired']),
  'src/components/forms/radio/radio.class.ts': Object.freeze(['fieldRequired']),
  'src/components/forms/select/select.class.ts': Object.freeze(['fieldRequired']),

  // Kbd forwards a closed set of kbd* map values through a localize callback. The generic values
  // below are incidental literals in its a11y helper graph, not keys the callback can receive.
  'src/components/overlays/kbd/kbd.class.ts': Object.freeze([
    'collapse',
    'details',
    'map',
    'navigation',
    'open',
    'progress',
    'search',
    'select',
  ]),
});
