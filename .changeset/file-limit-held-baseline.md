---
"@aceshooting/lyra-ui": minor
---

`<lr-file-input>` and `<lr-drop-zone>` can now enforce a cumulative `maxFiles`/`maxTotalSize` cap
across separate picker or drop sessions. Both limits previously counted only the files the control
itself held, so with `nonRetaining` (or after a reload in retaining mode) a user already holding 99
server-persisted files could add 50 more without the control ever rejecting, and the consumer had to
re-implement the aggregate check and render its own error.

Two optional numeric properties, `heldFileCount` (`held-file-count`) and `heldTotalSize`
(`held-total-size`), are the numeric counterpart of `valuePresent`: they are added to the running
totals before a batch is evaluated, in both retaining and non-retaining modes, so an over-cap batch is
rejected through the control's own rejection UI with the existing `maxFiles`/`maxTotalSize` reasons.
Both default to `0`, which reproduces today's behavior exactly, and a negative, `NaN` or infinite
value is treated as `0`. The `lr-files` detail also gains `remainingFiles` and `remainingTotalSize`
(`null` while that limit is unset), so a consumer can say how many more files may be added. The
aggregate arithmetic is now shared by both components, so the contract cannot drift between them.
