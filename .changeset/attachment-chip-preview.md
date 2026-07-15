---
'@aceshooting/lyra-ui': minor
---

`lyra-attachment-chip` gains a preview action: a new `previewSrc` property (used when `file` is
unset; a real `File` takes precedence via a temporary blob URL) and `previewable` boolean (default
`true`) show a new `preview-button` part whenever a file or preview source is available, emitting
`lyra-preview` (`detail: { id, name, mimeType, src }`) to open `<lyra-document-viewer>` with the
same effective MIME type. `lyra-document-viewer` gains a matching `download-link` slot and
`lyra-download` event for a safe native download action. Both properties/events are additive and
default off/no-op, so existing usages are unaffected.
