---
'@aceshooting/lyra-ui': minor
---

Data visualization navigation and activation handlers leave Alt, Ctrl, Meta and IME-composing keys to the browser.
The heatmap and word cloud clear their drawn focus rings on blur. Word cloud keyboard focus announces the current word, including the first word on initial focus.
Heatmap matrix-source tooltips open beside the pointer and can be dismissed with Escape. Calendar-mode labels use the Gregorian calendar.
Small values and shares in heatmap tooltips and labels, sparkline summaries, and the context meter keep their significant digits.
Funnel stage numbers and sequence-strip legend counts are isolated from adjacent RTL text.
Funnel bars, sequence-strip cells and markers, word-cloud and heatmap legend swatches, gauges, and sparklines preserve data paint in forced colors.
Sequence-strip tooltips wrap, fit inside the strip, stay opaque over disabled cells, and close on Escape. Enabled cells expose a keyboard activation hint.
Gauges ignore malformed thresholds, fit narrow containers, and keep linear captions proportional as the track resizes.
The sparkline no longer clips its first and last points.
Linked stats deliver one click to host listeners.
Calendars announce month navigation and preserve hover feedback on selected days. Use the new `lr-month-change` event in place of the deprecated `lr-view-change` event.
The context meter uses its summary as a fallback name and emits `lr-segment-selection-change` after a default selection toggle.
Stats and context meters show when a collection exceeds the input limit.
Sparkline marks, stat exact-value hover color, and calendar event hover tint have component theme tokens.
Heatmaps accept equivalent CSS color spellings and require canonical Gregorian dates for calendar cells.
Cancelled heatmap drags suppress their own release click without swallowing later clicks.
Canvas-only heatmaps build the cell index on demand, and sparklines reuse line geometry across unrelated updates.
Static sequence strips mount a source announcement region only when a source is assigned.
Funnel rendering tolerates revoked arrays and reads array limits without invoking a length getter.
Stat values expose their exact text to assistive technology, including when the card is a link.
