---
'@aceshooting/lyra-ui': minor
---

`lr-attachment-chip`: a non-empty, safe `thumbnail-src` and a non-empty `preview-src` now take precedence over the blob URL derived from `file`, while `file` keeps supplying the name, size and MIME type. With `thumbnail-src` plus `preview-src` (or `without-preview`) the chip creates no `blob:` URL at all, so a page whose Content-Security-Policy has no `blob:` in `img-src` can keep passing the `File` and supply a `data:` or same-origin thumbnail. Previously `thumbnail-src` and `preview-src` were ignored while `file` was set. The docs now note that showing a `File`'s own image needs `blob:` in `img-src`.
