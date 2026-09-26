---
'@aceshooting/lyra-ui': major
---

`lr-file-input`: the form label and the dropzone instruction are now independent surfaces. A set `label` renders only as the form-control label (and names the dropzone button); it no longer replaces the localized drop-or-browse instruction inside the dropzone. `label=""` and whitespace-only labels now render exactly like an omitted label: no visible form label, the localized instruction is shown, and the instruction names the button (previously an empty label blanked both and left the button without an accessible name). Labelled instances now show the instruction, which is often longer than the label, inside the box, so it can wrap in `compact` toolbars. `lr-eval-dataset`'s `import` part is now a `compact` control that shows the localized `evalDatasetImportLabel` once as its dropzone text and uses it as its accessible name, with no separate form label.

**Migration**

- Custom dropzone copy via `label` on `lr-file-input`: move it to `<span slot="dropzone">…</span>`. Keep `label` only if you also want a visible form label; otherwise add a matching host `aria-label` (or `accessible-label`) so the accessible name contains the visible text.
- Icon-only dropzone via `label=""`: slot your glyph or an empty element into `dropzone` and name the control with a host `aria-label`. A bare `label=""` now shows the instruction and uses it as the name.
- `lr-eval-dataset`: override the import copy through `evalDatasetImportLabel` (`.strings` on `lr-eval-dataset` or `registerLyraLocale()`), and restyle the control through `::part(import)`.
- Your own components that render `lr-file-input` inside their shadow root: slot the copy yourself, because per-instance `.strings` does not cascade into nested components.
