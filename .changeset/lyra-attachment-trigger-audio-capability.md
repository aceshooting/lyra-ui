---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-trigger` gains an `'audio'` capability, following the existing `camera` capability's
request-only pattern exactly: activating it fires `lyra-audio-request` (no embedded recorder), and the
host opens its own capture UI — typically `<lyra-push-to-talk>` in a `<lyra-overlay>`/popover — then
hands the resulting blob to its attachment tray. Purely additive: the default `capabilities` stays
`['files']`, and every existing `files`/`image`/`camera` behavior is unchanged.
