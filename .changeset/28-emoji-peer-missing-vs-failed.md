---
"@aceshooting/lyra-ui": minor
---

`<lr-emoji-picker>` now tells a missing `emoji-picker-element-data` peer apart from one that is installed but fails to load. A peer whose module cannot be resolved logs "is not installed" with the install command and shows the new localized `emojiPickerPeerMissing` message ("Emoji are not available.") without a Retry button. A peer that was found but could not be loaded or validated (a network or JSON/import-attribute error, an incompatible version, a module without the expected data array) logs that cause with the underlying error and keeps "Could not load emoji." with `load-retry`. Both cases still fail closed, announce the message once and emit `lr-load-error`. A missing peer is imported and warned about once per page, for every picker and locale, since it cannot appear later; a failed load is still retried. `emojiPickerPeerMissing` is translated in every shipped catalog; override it through `registerLyraLocale()` or `.strings`.
