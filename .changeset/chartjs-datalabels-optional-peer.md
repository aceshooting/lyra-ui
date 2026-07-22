---
"@aceshooting/lyra-ui": minor
---

Add `chartjs-plugin-datalabels` (`^2.2.0`) as a new **optional** peer dependency, backing the new
`data-labels`/`stack-totals` chart attributes.

It is optional in the same sense as the other chart peers: install it only if you use those two
attributes. Without it, charts render exactly as before and the label layer fails closed rather than
throwing.
