---
"@aceshooting/lyra-ui": patch
---
lr-command-palette and lr-tour now paint above an already open `lr-dialog` (browser top layer); an interactive tour step is promoted only when its target is in the top layer or a containing block traps it, so overlays its target opens stay above it.
