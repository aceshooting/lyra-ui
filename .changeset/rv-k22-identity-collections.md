---
"@aceshooting/lyra-ui": patch
---
`lr-eval-run`, `lr-eval-dataset` and `lr-trace-tree` keep their example and span records by identity, so batches, datasets and traces whose records carry tool results, metadata, class instances or typed arrays are no longer cut to a few hundred or thousand rows.
