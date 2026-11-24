---
"@aceshooting/lyra-gen": minor
---

Generated nodes can declare `a11y`: `label` fills the role's own accessible-name property (and satisfies required names), `description` becomes `aria-description`, and on non-interactive roles `live` (`off`/`polite`) and `hidden` set a live region or hide decorative content; interactive roles can never be hidden or made live regions.
