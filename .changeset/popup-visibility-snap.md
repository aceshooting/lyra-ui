---
"@aceshooting/lyra-ui": patch
---

`lr-popup` (and every overlay built on it) no longer reports an activated popup as `visibility: hidden` for the first moment of its entry fade. Visibility now flips at once when the popup shows and holds until the exit fade ends when it hides; only opacity animates, over `--show-duration` and `--hide-duration` as before. The computed `transition-duration` and `transition-delay` therefore list two values, one for opacity and one for visibility.
