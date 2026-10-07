---
"@aceshooting/lyra-ui": major
---
`lr-eval-run`'s `label`, `lr-prompt-studio`'s `heading` and `lr-span-waterfall`'s `label` use an explicit empty string verbatim instead of falling back to the localized default. Migration: omit the attribute or property to keep the default text.
