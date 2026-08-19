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
  // The elapsed/token-count keys are chosen by two local dynamic lookups, which makes the
  // conservative fallback inspect transitive helpers. The generic values below are incidental
  // literals in that a11y/visibility helper graph, not keys either lookup can produce.
  'src/components/conversation/generation-metrics/generation-metrics.class.ts': Object.freeze([
    'collapse',
    'details',
    'map',
    'navigation',
    'open',
    'popover',
    'progress',
    'search',
    'select',
  ]),

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

  // Not form-associated: attachInternalsSafely() is the only import taken from
  // form-associated.ts, and the unrelated FormAssociated export owns the fieldRequired lookup.
  'src/components/layout/details/details.class.ts': Object.freeze(['fieldRequired']),

  // Not form-associated at all; form-associated.ts only reaches this graph transitively through
  // the composed form controls it renders, and each of those owns its own slice.
  'src/components/layout/drilldown-panel/drilldown-panel.class.ts': Object.freeze(['fieldRequired']),

  // The composed date/combobox controls put a dynamic segment-key map in this graph, which makes
  // the conservative fallback inspect transitive helpers. These generic catalog-shaped literals
  // come from those helpers; the filter bar itself localizes only its own three keys.
  'src/components/layout/filter-bar/filter-bar.class.ts': Object.freeze([
    'collapse',
    'date',
    'details',
    'map',
    'navigation',
    'open',
    'popover',
    'progress',
    'restore',
    'search',
    'select',
  ]),

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
