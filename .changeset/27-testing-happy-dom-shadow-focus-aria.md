---
'@aceshooting/lyra-ui': minor
---

`@aceshooting/lyra-ui/testing` gains `installHappyDomShims()`, `installHappyDomShadowFocusShim()` and `installHappyDomAriaControlsShim()`. Under Happy DOM, `ShadowRoot.activeElement` on a sibling shadow root now returns `null` instead of throwing, and `Element.ariaControlsElements` is reflected. Both are no-ops on engines that already behave. Consumers can drop their own patches and call `installHappyDomShims()` in their setup file.
