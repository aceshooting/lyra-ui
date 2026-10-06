---
"@aceshooting/lyra-ui": patch
---
A form control named by an external `<label>` now receives the label's accessible text: an `aria-hidden` required marker, hidden helper text and script content are left out, and an image's `alt` or a descendant's `aria-label` is included.
