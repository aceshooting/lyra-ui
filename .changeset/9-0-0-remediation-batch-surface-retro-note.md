---
"@aceshooting/lyra-ui": patch
---

Document further additive 9.0.0 public surface that had no changelog entry, found auditing the
two largest 9.0.0 remediation commits:

- `<lr-context-inspector>`: five new events — `lr-error`, `lr-copy-error`, `lr-export-error`,
  `lr-show`, `lr-hide` (all from its embedded copy/export controls).
- `<lr-graph>`: eight categorical fallback CSS custom properties, `--lr-graph-cat-1` through
  `--lr-graph-cat-8`, backing the default node-type color palette.
- `<lr-tag>`: new `lr-remove` event (non-cancelable notification that the remove button was
  activated).
- `<lr-rating>`: new `focus`/`blur` native-passthrough events, `focus()`/`blur()`/`click()`
  methods, and `base`/`rating` csspart compatibility aliases (same node, two names).
- A long tail of new, narrowly-scoped CSS custom properties (visual tokens only, no new
  interaction surface) on `<lr-activity-feed>`, `<lr-prompt-studio>`, `<lr-task-list>`,
  `<lr-tool-approval-dialog>`, `<lr-tool-param-form>`, `<lr-push-to-talk>`, `<lr-flow-controls>`,
  `<lr-menu-item>`, `<lr-chip-group>`, and further `<lr-rating>` properties; plus new slot aliases
  on `<lr-prompt-input>` (`start`/`leading`/`end`/`trailing`) and `<lr-push-to-talk>`
  (`microphone-icon`/`icon`), and new cssparts on `<lr-model-select>`, `<lr-push-to-talk>`, and
  `<lr-source-picker>`.

All additive and backward-compatible — nothing removed or renamed, no behavior change when left
unset.
