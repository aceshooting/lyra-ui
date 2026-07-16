---
"@aceshooting/lyra-ui": minor
---

Hardening pass across ~70 components: document the button/spinner interaction custom-property APIs
(`--lyra-button-width`, hover-brightness, active-scale, spinner-duration) and add missing cssparts;
`lyra-breadcrumb` now reads its accessible-name override from the standard `aria-label` attribute
(was `accessible-label`); phone-input preserves the caret through adapter reformats and ships a
libphonenumber-js-backed adapter path with a clearer incomplete-number message; prune unused
localization keys and size/line-height tokens; broaden test coverage across the library.
