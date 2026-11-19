---
'@aceshooting/lyra-ui': patch
---

Fix the review, schema and context inspectors for assistive technology: validation issue severity and redacted ranges are now announced as text, hunk Keep/Discard and prompt-studio message actions name their item, blank hunk, pane and test names fall back to the default name, and render-limit notices are announced.
Fix `lr-commit-card` and `lr-artifact-panel` copy outcomes being silent to screen readers, `lr-commit-card` line counts reordering under right-to-left text, and listener-written `files-expanded` values being overwritten.
Fix `lr-artifact-panel` restoring a version other than the one shown, and report its automatic fall back from the code view with `lr-view-change`.
Fix `lr-json-schema-viewer` constraint rows not being indented with their node.
Fix `lr-test-results` filter changes having no cancelable `lr-filter-request` and no announcement of the shown count.
Fix `lr-browser-frame` throwing when the `url` attribute is removed, and distinguish ping kinds by line style in forced-colors mode.
Fix `lr-eval-dataset` emitting `lr-example-select` from inside an update, `lr-eval-run` approval helpers throwing before first render, and Object.prototype-named status kinds in `lr-eval-run` and `lr-agent-eval-dashboard`.
