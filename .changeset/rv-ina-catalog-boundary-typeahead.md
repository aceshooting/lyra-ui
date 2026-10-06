---
"@aceshooting/lyra-ui": major
---
`lr-model-select` and `lr-voice-picker` now share the international pickers' catalog boundary and keyboard model. Their catalogs read at most the first 1,024 entries (previously up to 10,000), only through own data properties, so a row whose `id` or `label` is an accessor is omitted without running it. Migration: if a catalog can exceed 1,024 rows, narrow it before assigning (for example filter server-side, or switch to `allow-custom` free-text entry with your own suggestions), and give rows plain `id`/`label` data properties. New: in catalog (closed-dropdown) mode the trigger supports `lr-select`-style type-ahead — typed letters move the active row while the list is open, or commit the next matching enabled row (with `lr-change`) while it is closed.
