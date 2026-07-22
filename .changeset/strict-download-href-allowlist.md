---
"@aceshooting/lyra-ui": patch
---

Validate download anchors against a stricter URL allowlist than navigation anchors. A `mailto:` URL
is a legitimate navigation destination but names no retrievable bytes, so pairing it with a
`download` attribute produced an affordance that could never download anything.

`safeDownloadHref()` (internal) is now `safeLinkHref()` minus `mailto:`, and the download sinks use
it: `<lr-document-viewer>` and `<lr-document-preview>` omit their download link for a `mailto:`
`src`, `<lr-media-card>` falls back to its inert file chip, and `<lr-button>` falls back to the
native `<button>` when `download` is set alongside a `mailto:` `href` (a `mailto:` href *without*
`download` still renders the anchor, unchanged).

Behavior change: the `safeLinkHref()` re-exported from the package root is `<lr-media-card>`'s
download-sink wrapper, so it now returns `null` for `mailto:` where it previously returned the URL.
The general-purpose navigation validator is unchanged.
