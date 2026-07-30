---
"@aceshooting/lyra-ui": patch
---

Repair four regressions left by earlier fixes:

- `<lr-radio-group>`: arrow-key selection now emits `input` and `change` alongside `lr-change`, as
  click and Space already did and as native `<input type=radio>` does. The earlier fix for a
  duplicate `lr-change` had left the keyboard path emitting only the group event, so a consumer
  bound to the native-mirroring events silently missed every keyboard selection.
- `<lr-progress-ring>`: an unslotted ring is named from the localized fallback again. Its slot's
  fallback content is the formatted percent, and `assignedNodes({flatten:true})` returns fallback
  children when nothing is assigned, so the control had been naming itself "40%" and no
  `registerLyraLocale()` override could reach it.
- `<lr-tour>`: opening a detached tour no longer locks scroll on the document or installs a global
  Escape handler with nothing visible, matching the guard `<lr-dialog>` already had.
- `text-quote` anchors and highlights now case-fold with the component's locale in
  `<lr-docx-viewer>`, `<lr-pdf-viewer>`, `<lr-markdown>` and `<lr-markdown-core>`. Under `lang="tr"`
  a quote of "istanbul" silently failed to match "İSTANBUL" in these four while resolving correctly
  in every viewer built on the shared text-viewer mixin.
