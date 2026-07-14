---
"@aceshooting/lyra-ui": minor
---

`lyra-menu`'s `role="menu"` popup now honors a host-level `aria-label` attribute over both the `label` prop and its localized default, matching `lyra-select`/`lyra-model-select`'s established `this.getAttribute('aria-label') || <computed default>` precedence. Additive — `aria-label` is unset by default, so every existing consumer (whether relying on the default `"Menu"` text or an explicit `label` prop) renders byte-identical to before.
