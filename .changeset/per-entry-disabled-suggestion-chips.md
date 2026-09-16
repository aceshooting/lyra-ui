---
"@aceshooting/lyra-ui": minor
---

`<lr-suggestion-chips>` suggestions accept `disabled`, so a suggestion that is visible but not
currently offerable stops being a live, focusable control that does nothing. Activation emits
nothing and keyboard navigation steps past it. A suggestion that does not set it renders exactly as
before.
