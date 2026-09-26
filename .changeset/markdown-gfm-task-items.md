---
"@aceshooting/lyra-ui": minor
---

`lr-markdown` and `lr-markdown-core`: GFM task-list items no longer show a bullet beside their
checkbox. In unordered lists the read-only checkbox now takes the bullet's place, so task text
lines up with neighbouring items; ordered lists keep their numbers. The checkbox is drawn with
design tokens (a visible border, and a brand fill with a check mark when checked) instead of the
browser's faint disabled styling, in light, dark and forced-colors modes, keeps its fill when
printed, and stays disabled. The space previously rendered after the checkbox is now a margin. New
CSS parts `task-list`, `task-item`, `task-item-checked` (a checked task, for styling completed
items) and `task-checkbox`, also forwarded by `lr-streaming-text` and `lr-streaming-text-core`,
allow restyling. The new `--lr-markdown-task-checkbox-size` custom property resizes the checkbox
while keeping the text aligned. An unordered list made only of task items carries `role="list"`
so it is still announced as a list.
