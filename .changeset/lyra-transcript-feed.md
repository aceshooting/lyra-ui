---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-transcript-feed>`: a data-driven live-captions surface for an in-progress voice session —
`entries` in (`{ id, speaker?, text, interim?, timestamp? }[]`), reconciled keyed by `id` so a same-id
interim-to-final upgrade moves the row into the announcing `role="log"` region without a duplicate
announcement. Ships the shared stick-to-bottom "follow" contract (`follow`/`lyra-follow-change`, the
same vocabulary `lyra-terminal` uses). No dependency, no STT/diarization built in — bring your own
transcription source and stream entries in.
