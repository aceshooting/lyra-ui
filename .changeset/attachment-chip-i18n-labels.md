---
"@aceshooting/lyra-ui": minor
---

`<lyra-attachment-chip>`: added four label-override properties for i18n/locale — `removeLabel`/`retryLabel` (`remove-label`/`retry-label` attributes, the verb prefixed to the remove/retry buttons' `aria-label` ahead of the interpolated filename) and `uploadingLabel`/`uploadFailedLabel` (`uploading-label`/`upload-failed-label` attributes, the verb/phrase used in the visible uploading/error status text, keeping the live percentage interpolation intact for `uploadingLabel`). All four default to today's exact hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload failed'`), so leaving them unset changes nothing for existing consumers.
