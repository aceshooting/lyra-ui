---
"@aceshooting/lyra-ui": patch
---

Consolidate shared component styling without changing how anything renders.

- Keyboard focus rings, hover and press fills, disabled controls, container hosts and form hint and error tone now come from shared style fragments instead of per-component copies.
- The form pickers (emoji, locale, color, date, rubric) compute hint and error presence and `aria-describedby` through the shared form-control helper.
- The status, retry, check and bookmark glyphs shared across components render from the common icon set.
