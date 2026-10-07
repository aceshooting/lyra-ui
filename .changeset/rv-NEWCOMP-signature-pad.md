---
"@aceshooting/lyra-ui": minor
---
lr-signature-pad: new form control that captures a drawn signature with a pointer, touch or the keyboard and submits it as a PNG data URL (no form entry while empty). Strokes are stored as fractions of the pad and drawn as SVG, so they survive resizes and screen-density changes, and assigning `strokes` restores a saved signature.
