---
'@aceshooting/lyra-ui': patch
---

Fixed `lr-radio-group` and `lr-slider` so an out-of-vocabulary `orientation` value (whether set as an attribute or directly on the property) now clamps to the documented default instead of being forwarded verbatim into `aria-orientation`.
