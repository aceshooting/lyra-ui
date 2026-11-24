---
"@aceshooting/lyra-gen": minor
---

New `@aceshooting/lyra-gen/dashboard-plan.js` entry point: `planDashboard(view, catalog)` returns a deterministic, frozen plan of a dashboard's panels (role, accessible label, query name with literal or state-pointer parameters, live and repeat sources, interactive controls with the state paths they own) plus static warnings for unowned parameter reads, live reads with no data source, repeats without a template and panels with nothing to show. `dryRunDashboard(view, catalog, { queryProvider, ... })` runs every bound query once against the current state without running actions or changing state, checks results against the catalog schemas as `lr-gen-view` does with a per-query timeout and abort, and reports each panel as ok, empty, failed, invalid-result or oversized (generic messages only) with an overall `publishable` flag, so a host can verify a dashboard before publishing it.
