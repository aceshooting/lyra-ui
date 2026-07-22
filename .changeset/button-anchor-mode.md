---
"@aceshooting/lyra-ui": minor
---

Add `href`, `target`, and `download` to `<lr-button>`, giving it a real `<a>` anchor mode instead of
a `<button>` that a consumer has to wrap or intercept.

`rel` is derived from `target` rather than being independently settable, so a `target="_blank"`
button cannot ship without `rel="noopener noreferrer"`. Hrefs are validated through the internal
link allowlist; a `download` paired with a `mailto:` href falls back to the native `<button>`, since
`mailto:` names no retrievable bytes.
