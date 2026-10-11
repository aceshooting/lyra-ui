---
'@aceshooting/lyra-ui': minor
---

Add independent heatmap hover-ring styling while preserving keyboard focus feedback. Contain deferred fitted heatmap frames after their allocation shrinks, preserve chart data when a canvas context cannot initialize, and keep anchored overlays above sticky cells when composed through shadow roots. The Happy DOM setup helper now supplies missing shadow-root stylesheet collections and HTML direction hints.

Review bundled-size allowances for the added overlay ancestry tracking, canvas fallback, and heatmap containment. Only exceeded JavaScript and component aggregate limits advance to their measured sizes; existing passing limits, optional-peer exclusions, and CSS budgets remain unchanged.
