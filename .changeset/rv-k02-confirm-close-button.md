---
"@aceshooting/lyra-ui": patch
---
confirm(): the transient dialog no longer renders a header close button, which needed an `lr-icon-button` the helper never registered and so could not be reached by keyboard; Cancel, Escape and the backdrop still resolve `false`.
