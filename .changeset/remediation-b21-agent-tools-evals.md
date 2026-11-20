---
'@aceshooting/lyra-ui': minor
---

Fix the review, schema and context inspectors for assistive technology: validation issue severity and redacted ranges are now announced as text, hunk Keep/Discard and prompt-studio message actions name their item, blank hunk, pane and test names fall back to the default name, and render-limit notices are announced.
Fix `lr-commit-card` and `lr-artifact-panel` copy outcomes being silent to screen readers, `lr-commit-card` line counts reordering under right-to-left text, and listener-written `files-expanded` values being overwritten.
Fix `lr-artifact-panel` restoring a version other than the one shown, and report its automatic fall back from the code view with `lr-view-change`.
Fix `lr-json-schema-viewer` constraint rows not being indented with their node.
Fix `lr-test-results` filter changes having no cancelable `lr-filter-request` and no announcement of the shown count.
Fix `lr-browser-frame` throwing when the `url` attribute is removed, and distinguish ping kinds by line style in forced-colors mode.
Fix `lr-eval-dataset` emitting `lr-example-select` from inside an update, `lr-eval-run` approval helpers throwing before first render, and Object.prototype-named status kinds in `lr-eval-run` and `lr-agent-eval-dashboard`.
Add a cancelable `lr-view-change-request` to `lr-artifact-panel`, a cancelable `lr-example-select-request` to `lr-eval-dataset`, a post-commit `lr-vote-change` to `lr-compare-panel`, and a correlated `lr-example-citation-open` to `lr-eval-run`.
Fix `lr-eval-run` silently showing empty example details when its detail views fail to load; it now shows and announces a localized notice and retries on the next expand.
Fix `lr-eval-run`, `lr-eval-result` and `lr-eval-dataset` letting nested copy, content, citation, chip, table and diff events escape the host.
Fix `lr-json-schema-viewer` throwing on malformed `enum`, `examples`, `$ref`, `type`, `title` or `description` keywords, resolving selections through inherited property names, and its keyboard walker ignoring composition; its render-limit notices are now notes.
Fix `lr-agent-eval-dashboard` rounding small nonzero metrics to zero and reading inherited run metric names.
Fix `lr-artifact-panel` selected view button having no hover or press feedback, draw its version chevrons as icons, and keep server-rendered code views visible before hydration; `lr-browser-frame` no longer paints its screenshot over server-rendered live content.
Fix `lr-compare-panel` panes being tab stops when nothing scrolls, `lr-test-results` provider rows each forming a separate list, and `lr-eval-dataset` tags ignoring the locale's list format.
Add `--lr-change-review-file-border-color`, `--lr-change-review-file-radius` and `--lr-change-review-header-hover-bg` to `lr-change-review`; `lr-browser-frame` toolbar actions follow the shared button tokens.
Fix result cards, eval runs, test results and eval results overflowing narrow flex and grid allocations.
Indicate the selected `lr-json-schema-viewer` trigger with a themeable fill and a visible outline in forced colors.
Reuse file, hunk and redaction projections in `lr-change-review` and `lr-context-inspector` across unrelated updates.
Keep the last 500 distinct `lr-browser-frame` action markers in input order and announce the overflow notice.
Show a performance advisory when `lr-prompt-studio` contains more than 500 rows.
Show an unavailable note when an explicit `lr-agent-eval-dashboard` metric selection matches no metric; the dashboard still displays the first valid metric.
Use one Tab stop for run history in `lr-agent-eval-dashboard`, file rows in `lr-commit-card`, and test names in `lr-test-results`, with ArrowUp, ArrowDown, Home and End navigation.
