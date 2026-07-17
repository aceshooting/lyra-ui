---
"@aceshooting/lyra-ui": minor
---

Add `lyra-rubric-form`: a configurable annotation rubric (LangSmith annotation-queue style) —
score, category, and freeform-comment keys with a submit-and-next flow for working through an eval
queue. Follows `lyra-tool-param-form`'s exact `ElementInternals`-attached-directly, JSON-serialized
form-value pattern; a `score` key renders `lyra-segmented` (≤10 integer steps) or `lyra-slider`,
`category` renders `lyra-select` or `lyra-checkbox-group` (`multiple`), and `comment` renders
`lyra-textarea`.
