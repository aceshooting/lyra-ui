---
'@aceshooting/lyra-ui': minor
---

- `registrations.json` rows gain `lazyRegisters`: the tags in `registers` that an entry defines on first use through a lazy import rather than when the import settles (for `lr-table.js`, `lr-pagination` and `lr-skeleton`).
- `lr-agent-question` announces a response form that fails to load with its own `agentQuestionFormLoadFailed` message (same wording in every catalog), so all seven `genView*` renderer messages ship in each locale's `conversation` slice again, as documented for `@aceshooting/lyra-gen`.
- `lr-time-range` no longer keeps host-relationship observers when its first connection is interrupted before the first render.
- `lr-select`'s "not in catalog" badge inside a `multiple`-mode tag uses the tag's text color, meeting WCAG AA contrast on the tag fill.
