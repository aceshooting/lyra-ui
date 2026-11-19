---
'@aceshooting/lyra-ui': patch
---

Time input segments, time range handles, OTP segments and token buttons no longer act on or cancel Ctrl/Alt/Meta-modified or IME-composing keys.
Code editor: Tab indents every line of a multi-line selection instead of replacing it, never inserts past `maxlength`, and an auto-resizing editor refits when its width changes.
Textarea and code editor `rows` return to 4 when the attribute is removed; an IME-confirming Enter no longer flushes a pending settle on input and textarea.
Signature pad: `focus()`, `blur()` and `click()` reach the drawing surface, a held Space or Enter no longer flips the pen repeatedly, and a signature assigned before layout is re-exported at the measured aspect ratio.
Time input: the day-period segment accepts the first letter of the displayed localized label, a show request vetoed by a disabling or removing listener no longer opens, and the segment group no longer carries popup state that belongs to the expand button.
Token input: add and remove requests keep a controlled write made by their listener, and a held Backspace removes one token.
Phone input: the country select no longer leaks a native `input` event before the country applies, and a failed flag-module load can be retried.
Time range: an unselected preset tints on hover.
OTP input: the active segment ring is drawn inside the segment so the scrolling row no longer clips it.
Token input: an edit request listener that rewrites, disables or removes the field no longer has its change overwritten by a stale write.
Time range: the handle eases its hover paint with the shared interactive transition.
