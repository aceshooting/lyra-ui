---
"@aceshooting/lyra-ui": minor
---

`lr-media-card` gains `lr-media-download-request`, the canonical cancelable veto point before a safe file chip's native download/open, named like the library's other `*-request` veto events. It carries the same `{ src, filename }` detail as before. `lr-before-media-download` is deprecated in favour of it, with removal no earlier than 23.0.0: it keeps firing unchanged right after the canonical event from the same activation, with an equal but separate detail, and a `preventDefault()` on either event suppresses the download/open. A veto through the deprecated alias logs one development-mode warning per page; a listener that only observes it does not, so move every `lr-before-media-download` listener to `lr-media-download-request`.
