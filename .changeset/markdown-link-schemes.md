---
'@aceshooting/lyra-ui': minor
---

Add `linkSchemes` (attribute `link-schemes`) to `lr-markdown` and `lr-markdown-core`, forwarded by `lr-streaming-text` and `lr-streaming-text-core`. It narrows which link destinations may become anchors to a space- or comma-separated subset of `http`, `https`, `blob`, `mailto` and `relative`, so `link-schemes="https"` keeps only https links in model-generated text. A refused link renders as plain text, never as an anchor, in every `html-mode`; raw-HTML and SVG anchors are unwrapped after sanitization and `<area>` elements removed. Unknown tokens are ignored, so the list can never widen the default allowlist. Unset keeps today's behavior, and sanitization is unchanged.
