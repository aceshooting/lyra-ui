---
"@aceshooting/lyra-ui": patch
---

`LyraElement`'s internal `scheduleAfterUpdate()` now coalesces per key instead of collapsing every
caller in an update cycle onto one slot. It tracked pending work in a single boolean, so the second
caller in a cycle early-returned and its callback was dropped and never replayed — a component that
scheduled two genuinely different pieces of after-update work silently lost one of them. Repeated
schedules under the same key still collapse to one run, so the load path keeps producing one fetch
per cycle rather than one per property write.
