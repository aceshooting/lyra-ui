---
"@aceshooting/lyra-ui": minor
---

Add density and chrome-less escape hatches to six card-chrome components so an embedded card no
longer forces its own frame on a host that already draws one:

- `lr-agent-run`, `lr-entity-card`, `lr-source-card` each gain both a reflected `compact` boolean
  (tighter padding/gap, tunable via `--lr-<component>-compact-padding` / `-gap`) and
  `appearance="plain"` (drops border, background, padding and radius). `plain` wins over `compact`
  when both are set.
- `lr-stack-trace` and `lr-flow-run-overlay` gain `appearance="plain"` — for nesting inside an
  `lr-result-card` / `lr-agent-run` or a host toolbar that already draws a border, without doubling
  the frame. `lr-flow-run-overlay`'s `plain` also drops its floating-surface shadow.
- `lr-file-input` gains a reflected `compact` boolean (tighter dropzone padding, gap and label
  font, tunable via `--lr-file-input-compact-padding` / `-gap` / `-font-size`) so the dropzone fits
  a toolbar or table cell.

All escapes default off; an unset component renders byte-identically to before. Interactive
affordances that live on child controls (agent-run's Cancel/Retry, stack-trace's copy/frame
buttons, source-card's title/toggle) keep their own chrome under `plain`.
