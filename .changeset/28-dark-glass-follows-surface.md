---
"@aceshooting/lyra-ui": patch
---

Dark Glass chrome now follows the theme's surface ramp. Below 70% opacity the fill is deepened toward a darkened `--lr-color-surface` (10% of the surface, the rest black) instead of pure black, so a consumer who lifts the dark surface tokens (for example a neutral grey `--lr-theme-color-surface-default`, `-raised` and `-overlay`) gets chrome that follows them rather than staying pure-black-anchored. The share is small because stock palettes are qualified for 4.5:1 text over a white backdrop at 60% opacity; set `--lr-theme-surface-opacity` to 0.7 or higher to paint the palette's own overlay colour. Stock palettes move by at most about 3 levels per channel.
