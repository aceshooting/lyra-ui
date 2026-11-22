---
'@aceshooting/lyra-ui': minor
---

`lr-combobox`: an option returned by `dataSource` (or a `source` row) may carry `html`, rich markup
rendered in place of the label text as the new `option-html` part. The markup always passes through
the optional `dompurify` peer and a passive-content pass, and a superseded result is never applied.
The text `label` stays the row's accessible name, filter text and committed text. When the peer is
missing or fails, rows fail closed to their plain labels, the listbox shows the localized
`comboboxRichContentUnavailable` note (`option-html-fallback` part) and the message is announced once.
