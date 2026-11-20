---
'@aceshooting/lyra-ui': minor
---

Time input segments, time range handles, OTP segments and token buttons no longer act on or cancel Ctrl/Alt/Meta-modified or IME-composing keys.
In the code editor, Tab indents selected lines while preserving their text, selection direction, and `maxlength`. An auto-resizing editor refits when its width changes.
Textarea and code editor `rows` return to 4 when the attribute is removed; an IME-confirming Enter no longer flushes a pending settle on input and textarea.
Signature pad: `focus()`, `blur()` and `click()` reach the drawing surface, a held Space or Enter no longer flips the pen repeatedly, and a signature assigned before layout is re-exported at the measured aspect ratio.
Time input: the day-period segment accepts the first letter of the displayed localized label, a show request vetoed by a disabling or removing listener no longer opens, and the segment group no longer carries popup state that belongs to the expand button.
Token input: add and remove requests keep a controlled write made by their listener, and a held Backspace removes one token.
Phone input: the country select no longer leaks a native `input` event before the country applies, and a failed flag-module load can be retried.
Time range: an unselected preset tints on hover.
OTP input: the active segment ring is drawn inside the segment so the scrolling row no longer clips it.
Token input: an edit request listener that rewrites, disables or removes the field no longer has its change overwritten by a stale write.
Time range: the handle eases its hover paint with the shared interactive transition.

Whitespace-only accessible names fall back to a visible label or localized name in text, time, and signature controls.
Form fields render error descriptions before hints, match the shared field radius, and use the shared hint and error styles.
Text inputs follow the entered text direction. Numeric and code entry keep a left-to-right base direction in RTL layouts.
Time input emits one change pair when the last visible segment of a previously complete time is cleared. A partial draft emits input only. Time segments and input actions follow the shared interaction transition.
Signature pad announces when a drawing reaches its stroke or point limit.
Token input deprecates its implicit unlimited window. Set `max-tokens-visible="200"` for a paged window or `max-tokens-visible="0"` to keep every token mounted. The notice release keeps the unlimited default and submits the full list in either mode.
Signature pad supports `readonly` and emits `lr-clear` after the Clear button empties it.
Token input forwards autocomplete, keyboard mode, and Enter hints to both text fields.
Textarea, phone input, token input, and OTP input expose theme tokens for placeholder colors.
Signature pad updates the active stroke path incrementally and reuses committed paths when supporting text changes.
Code editor Tab indentation participates in native undo and redo. Scrolling reuses live text metrics and respects changes to the textarea’s line height.
Textarea and code editor retain native editing when a resize observer cannot attach.
Token input, phone input, OTP input, code editor and signature pad accept the shared `--lr-form-control-invalid-border-color` theme override.
Signature pad exposes surface and clear-button paint tokens. Code editor accepts the shared field padding and font-size tokens for both text and line numbers.
Code editor applies its fill color to the line-number gutter.
Textarea and phone input return `null` for the selection direction before their native fields render.
Auto-resizing textareas resolve percentage height limits against the available space as their parent resizes.
