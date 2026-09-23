---
'@aceshooting/lyra-ui': patch
---

Fix `lr-tool-param-form.focus()`/`.blur()` (previously silent no-ops) to move focus into, and blur out of, its first field like `click()` already did. Fix a JSON Schema `const` on a non-enum `string`/`number`/`integer` property to pre-fill the field with the locked value and render its control read-only instead of an ordinary blank, fully-editable input.
