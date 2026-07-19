---
"@aceshooting/lyra-ui": minor
---

New `<lr-eval-result>`: rubric scoring, human review, and comparison across a single evaluation
example's runs (one per model or prompt version), LangSmith/Arize-eval-result style. Composes
three existing primitives directly rather than re-deriving their behavior: `<lr-data-grid>` renders
the `runs` comparison table (`columns` is a plain pass-through to its own `DataGridColumn[]`
shape); `<lr-rubric-form>` is the human-review scoring surface for whichever run is selected,
reading/writing that run's own `review` value and re-emitting its
`lr-input`/`lr-validity-change`/`lr-submit`/`lr-skip` events as
`lr-review-input`/`lr-review-validity-change`/`lr-review-submit`/`lr-review-skip` with the run id
attached; `<lr-diff-view>` compares the selected run's output against `baselineRunId`'s output --
`layout="split"` once they resolve to two distinct runs, `layout="unified"` (an all-equal diff,
i.e. a plain read of the one run's output) once they resolve to the same run or no baseline
resolves at all. `selectedRunId`/`baselineRunId` are both fully controlled (never mutated
internally) and fall back to `runs[0]?.id` purely for rendering when unset, so the component
renders something useful with zero configuration beyond `runs`; a `selectedRunId`/`baselineRunId`
that matches no entry in `runs` degrades gracefully (the comparison grid still renders, the
review/diff sections simply don't).
