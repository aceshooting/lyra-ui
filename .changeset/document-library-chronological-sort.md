---
"@aceshooting/lyra-ui": patch
---

`<lr-document-library>` now sorts its Updated column chronologically. It ordered rows correctly by
timestamp itself, then handed the composed `<lr-table>` both those rows and a `sortKey` without
`sort-mode="server"`, so the table sorted them a second time in client mode — from the column's
rendered output, which is a *formatted* date. The result was alphabetical by month name.
