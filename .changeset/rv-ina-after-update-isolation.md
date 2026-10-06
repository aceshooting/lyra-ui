---
"@aceshooting/lyra-ui": patch
---
When a component's post-update work throws synchronously (for example a viewer load rejecting malformed input), its other post-update work in the same cycle — autofocus, a locale-driven search refresh — still runs; the error is still reported.
