---
'@aceshooting/lyra-ui': patch
---

- `lr-input` follows the surrounding text direction again while it is empty, so in right-to-left layouts its placeholder and caret start on the correct side. Entered text still sets the field's direction. Date and time types, including `lr-native-time-input`, keep the surrounding direction.
