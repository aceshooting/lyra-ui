---
"@aceshooting/lyra-ui": patch
---

Dark Glass chrome now follows the theme's surface ramp. The fill below 70% opacity is deepened toward a darkened `--lr-color-surface` (30% of the surface, the rest black) instead of pure black, so a consumer who lifts the dark surface tokens (for example a neutral grey `--lr-theme-color-surface-default`, `-raised` and `-overlay`) no longer sees cards turn grey while `.lr-surface-chrome` panes stay near-black. The stock palettes move by only a few levels per channel.
