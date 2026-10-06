---
"@aceshooting/lyra-ui": patch
---
`lr-terminal` and `lr-notebook-viewer` ANSI output no longer prints escape debris: the `ESC ( B` charset reset emitted by `tput sgr0` (shown as a stray `(B`), save/restore cursor `ESC 7`/`ESC 8`, keypad modes `ESC =`/`ESC >` and other two- or three-byte escapes are stripped, as are DCS, SOS, PM and APC payloads such as sixel or kitty graphics and multiplexer passthrough. A control sequence broken by a new escape, a control character or non-ASCII text is abandoned at that byte instead of swallowing the following output up to the next letter.
