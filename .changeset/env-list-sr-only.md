---
"@aceshooting/lyra-ui": patch
---

`<lr-env-list>` no longer paints its screen-reader-only "Value hidden" announcement as visible text
beside the mask. The template emitted `class="sr-only"` but the component never adopted the shared
stylesheet that defines that class, and no rule in `LyraElement.styles` supplies it.
