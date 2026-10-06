---
"@aceshooting/lyra-ui": major
---
Text and date fields share one paint per `appearance` (outlined = surface + border, filled-outlined = raised + border, accent = quiet brand tint + brand border) and one focus cue (brand border plus the optional halo); `lr-phone-input` gains `appearance`. Migration: set the field's `--lr-*-fill` token to `transparent` to keep a transparent field, or its fill/border/color tokens to keep the loud accent.
