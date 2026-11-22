---
'@aceshooting/lyra-ui': minor
---

`lr-dialog` and `lr-drawer` open and close from markup alone. Activating any element with
`data-dialog="open <id>"` opens the dialog with that `id`, and activating a descendant with
`data-dialog="close"` closes the nearest owning dialog with the new `'close-action'` close reason;
`lr-drawer` uses `data-drawer` the same way. Both run the ordinary cancelable lifecycle, ignore
disabled, `aria-disabled` and inert actions, work across open shadow roots, and share one document
listener that is removed when the last dialog or drawer disconnects. Markup migrated from Web
Awesome that uses these attributes now works unchanged.
