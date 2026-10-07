---
"@aceshooting/lyra-ui": major
---
`lr-grounding-summary` and `lr-claim-evidence` now contain a citation badge's `lr-citation-open` and emit their own with `detail: { citation }`; `lr-rag-answer`'s `lr-citation-select` detail gains `action: 'activate' | 'open'`, a grounding open resolves by the citation record instead of a badge index, and it declares the source cards' `lr-open` while containing their `lr-expand`, the source list's `lr-toggle` and the Markdown renderer's `lr-content-settled`/`lr-copy`/`lr-copy-error`. Migration: read `detail.citation` instead of `detail.index`/`detail.sourceId`, and ignore `action: 'activate'` when you only handle the open (a double-click reports two before it).
