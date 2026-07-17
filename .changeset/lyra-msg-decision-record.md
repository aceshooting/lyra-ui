---
"@aceshooting/lyra-ui": minor
---

Recorded decision: `.msg` (Outlook) files are not supported this round. `.msg` is OLE/CFB binary per
MS-OXMSG; the available npm parser (`@kenjiuno/msgreader` plus its `decompressrtf` companion) is
below this library's maintenance bar for an optional peer. `.msg` files continue to resolve to
`<lyra-document-preview>`'s generic download fallback, exactly like any other unregistered format —
convert to `.eml` server-side to use `<lyra-email-viewer>` instead. No API change; this changeset
exists to document the decision, guarded by a permanent regression test.
