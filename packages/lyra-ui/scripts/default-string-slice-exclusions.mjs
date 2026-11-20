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
  // These pickers drive ElementInternals through non-mixin helpers from form-associated.ts. Its
  // unrelated FormAssociated export owns the fieldRequired lookup; none of these classes invokes it.
  'src/components/conversation/model-select/model-select.class.ts': Object.freeze(['fieldRequired']),
  'src/components/conversation/model-settings-panel/model-settings-panel.class.ts': Object.freeze(['fieldRequired']),

  'src/components/conversation/voice-picker/voice-picker.class.ts': Object.freeze(['fieldRequired']),

  // These controls import non-mixin helpers from form-associated.ts. Its unrelated FormAssociated
  // export owns the fieldRequired lookup; none of these classes invokes that export.
  'src/components/forms/radio/radio-button.class.ts': Object.freeze(['fieldRequired']),
  'src/components/forms/radio/radio-group.class.ts': Object.freeze(['fieldRequired']),
  'src/components/forms/radio/radio.class.ts': Object.freeze(['fieldRequired']),

  // Not form-associated at all; form-associated.ts only reaches this graph transitively through
  // the composed form controls it renders, and each of those owns its own slice.

  // `lr-filter-bar` needed a long exclusion list here while its class module bare-imported every
  // composed control it could render: those imports dragged the controls' own helper graphs in, and
  // the conservative fallback surfaced their generic catalog-shaped literals as if the bar localized
  // them. The bar renders each control by tag name only and no longer imports any of them, so its
  // graph reaches nothing but its own keys and the list became stale in full.

  // `lr-kbd` needed collapse/details/map/open here while its graph stayed open; its forwarded
  // kbd* map now resolves to a closed key set, so the call-scoped walk no longer admits them.
});
