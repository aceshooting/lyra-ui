---
'@aceshooting/lyra-ui': major
---

Use Up and Down to navigate emoji suggestions from search. Left and Right move the text caret.
Listen for `lr-activate` to observe every emoji pick, including a repeated selection. Value events fire when the selection changes.
Listen for cancelable date-input popup requests and settled events when assigning `open` or changing its attribute on a connected control.
Read `previousValue` alongside `value` on color, date, swatch and rubric value events.
Keep browser shortcuts, text composition and held activation keys from triggering unintended picker actions or repeated rubric submissions.
Distinguish button, icon-button and color-picker trigger hover and press in forced-colors mode.
Keep locale and date-input popups within the available space on both axes.
Isolate locale labels and left-to-right locale identifiers in bidirectional layouts.
Expose today's date and current period to assistive technology in the date picker.
Announce form errors before hints on date inputs, emoji pickers, color pickers and rubric forms.
Surface invalid date-input validator results as localized validation errors.
Announce the displayed calendar page after activating a previous or next navigation button.
Keep the selected custom swatch icon outlined when its glow is zero.
Keep emoji search and virtual scrolling usable when the browser rejects resize observation.
Remove a rejected open attribute from disabled and readonly color pickers and expose readonly on their inline sliders.
Release focus from the active nested editor when calling blur on a rubric form.
Resolve color-picker colour names in the picker's own document, so iframe-hosted pickers parse named and modern CSS colours.
Mark the selected color-picker swatch with an icon (`swatch-check` part) instead of a text glyph, and dim disabled swatches with `--lr-opacity-disabled`.
Mix hover and press over the existing fill of selected emoji cells, date-range days and the rubric submit button instead of replacing it.
Add `--lr-emoji-picker-grid-max-height` to cap the emoji grid.
Show a not-allowed cursor on disabled date-input actions and a default cursor while readonly.
Join currency names and symbols with the locale's list pattern.
Forward date-input `strings` to its popup calendar navigation labels.
Name emoji options from their glyph and groups from the localized fallback when a caller label is whitespace.
Add a `pressed` property to icon buttons for toggle actions.
Keep catalog pickers usable when the search field fails to load, and offer a localized retry.
Type the popup lifecycle, activation and clear events on all four catalog pickers.
Theme the catalog pickers' resting invalid borders without overriding focus or open styling.
Format secondary catalog identifiers and symbols with the locale's list pattern.
Mount the color picker editor only while the popup is open or inline.
Reuse unchanged rubric score choices when editing another field.
