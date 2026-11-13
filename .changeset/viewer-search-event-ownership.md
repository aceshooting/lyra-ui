---
'@aceshooting/lyra-ui': patch
---

Respect search changes made by `lr-search-change` listeners in CSV, dataset, spreadsheet,
PDF, and DOCX viewers. Clearing results during next/previous navigation no longer throws or
reports a successful navigation, and interrupted searches no longer restore cleared highlights
or override a newer navigation started by the listener.

The fix adds 268 unpacked bytes across four runtime modules. Four exceeded aggregate gzip
limits, the unpacked package limit, and the complete core-consumer limit advance only to the
next 64-byte boundary above their reviewed measurements. Passing limits and optional-peer
exclusions remain unchanged.
