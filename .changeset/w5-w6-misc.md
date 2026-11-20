---
'@aceshooting/lyra-ui': major
---

- Breaking (behaviour): a closed `lr-tooltip` in the default `description` label mode no longer observes its slotted content, ancestors or label references. Its description, dialog-versus-tooltip role and actionability are read when content is assigned, when its trigger takes focus, and when it opens, and are kept current while open, while the trigger has focus, and always in `label-mode="label"`. Code that edits a closed tooltip's content and reads its description element or `role` immediately, without focusing the trigger or opening it, now sees the previous value. Migration: open the tooltip, focus its trigger, or use `label-mode="label"` before reading; screen-reader behaviour is unchanged because a description is only exposed in those states.
- The companion elements `lr-docx-editor` (lyra-docs) and `lr-gen-view` (lyra-gen) now have their own `custom-elements.json`; their tags appear in the web-types and VS Code editor data, each gets a `llms/components/<tag>.md` page, and `@aceshooting/lyra-ide`'s published `custom-elements.json` lists them.
- `normalizeHistogramBinCount` no longer throws for an object whose `toString` is undefined; it returns 0.
- Announcement live regions in about 30 components are owned by the shared announcement controller, so a component moved to another document re-mounts its live region there.
- Pointer drags that resize table columns and split-panel separators share one listener helper (no behaviour change).
