---
"@aceshooting/lyra-ui": major
---
`lr-chunk-inspector`, `lr-claim-evidence` and `lr-retrieval-trace` treat `label=""` as an explicitly empty name, like the rest of the retrieval family, instead of restoring the localized default (`lr-retrieval-trace` forwards it to its timeline, which now stays unnamed). Migration: omit `label` to keep the default. `lr-knowledge-base-admin` and `lr-research-progress` keep a name on their tablist and progressbar when `label` is empty.
