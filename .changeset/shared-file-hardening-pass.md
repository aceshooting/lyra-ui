---
"@aceshooting/lyra-ui": patch
---

Shared-infrastructure hardening pass following a full-library audit:

- `lyra-contact-viewer` and `lyra-email-viewer` now expose a proper localized `aria-label` on their
  root surface (previously had no naming mechanism at all); `lyra-calendar-viewer` gets the same
  fallback chain's final localized tier.
- `lyra-stat`'s trend announcement now interpolates the percentage into one localized template
  instead of concatenating separately-localized fragments (word order safe for non-English locales).
- Fixed a real bug in `lyra-model-settings-panel`'s `decimalPlaces` helper that returned `0` instead
  of the correct precision for exponential-notation step values (e.g. `1e-7`); it now shares the
  same exponential-aware implementation as `lyra-slider`/`lyra-time-range` via a new
  `src/internal/numbers.ts` export instead of a diverging local copy.
- Deduplicated five other byte-identical/near-identical helpers that had drifted into 2-5 separate
  component files each (`prefersReducedMotion`, canvas-context memoization, swatch-color
  sanitization, slotted-content detection, and a title-attribute-stripping mixin) into single
  `src/internal/` implementations.
- Removed an unused, never-adopted RTL helper (`rtlAwareSide`/`PhysicalSide`) from
  `src/internal/rtl.ts`.
- Added missing accessibility test coverage for `lyra-icon-button` and the standalone `lyra-option`
  element (previously the only two custom elements in the library with no axe check).
