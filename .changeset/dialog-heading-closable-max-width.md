---
"@aceshooting/lyra-ui": minor
---

Add `heading`/`closable` convenience chrome and a `--lyra-dialog-max-width` token to `<lyra-dialog>`. `<lyra-dialog>` previously required a consumer to hand-build any visible title bar (by slotting a real heading element) and any close affordance (via a footer button wired to `close()`) — `heading` now renders a visible header row with that text when no heading element is slotted (still deferring to a slotted heading, unchanged, when present), and `closable` renders a built-in close (X) button in that same header row, wired through the exact same `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`. `[part="panel"]`'s previously-hardcoded `max-inline-size: min(32rem, 100%)` is now `min(var(--lyra-dialog-max-width, 32rem), 100%)`, mirroring `<lyra-media-card>`'s `--lyra-media-card-max-height` — the default stays exactly `32rem` when unset. All three are additive/opt-in; existing consumers see no behavior change.
