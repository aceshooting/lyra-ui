---
"@aceshooting/lyra-ui": major
---
lr-widget: the fullscreen button no longer carries `aria-pressed`, which contradicted its state-swapping name ("Exit fullscreen, pressed"); migration: read the `fullscreen` property or attribute instead of the button's `aria-pressed`.
