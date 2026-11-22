---
'@aceshooting/lyra-ui': minor
---

New `prompt()` helper next to `confirm()`, at `@aceshooting/lyra-ui/components/overlays/dialog/prompt.js` (a granular subpath, so the root barrel does not carry `lr-input`). It opens a transient `lr-dialog` with one labelled `lr-input` (initial `value`, optional `placeholder` and `description`), focuses the field, submits on the confirm button or Enter, keeps the dialog open with an optional `validate()` message, and resolves `Promise<string | null>` (`null` on cancel, Escape, backdrop or removal). Default action labels use the localized `confirm`/`cancel` messages.
