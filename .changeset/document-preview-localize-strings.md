---
"@aceshooting/lyra-ui": minor
---

`lyra-document-preview`'s hardcoded English strings — the image-preview `alt` fallback
("Document preview"), the unsafe-URL error ("Document URL is not allowed."), the non-`Error`
fetch-failure message ("Failed to load document."), and the empty-`error-message` fallback
("Something went wrong.") — now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Its in-flight text-fetch spinner label ("Loading document…")
is now also wired through the existing `loadingDocument` message key. Default English output is
unchanged when no override is set.
