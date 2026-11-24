---
"@aceshooting/lyra-gen": minor
---

Add `<lr-gen-devtools>`, a read-only developer inspector for an `lr-gen-view` loaded from its own `@aceshooting/lyra-gen/devtools.js` entry point. Assign `.target` to a generated view to browse its node tree (selecting a node outlines it and marks it with a temporary `data-gen-inspected` attribute), the current and last ready revision with its `changes`, binding state with dirty pointers, live data, a bounded log of ready, state-change, action and error events, and the catalog's roles and actions. It never dispatches actions or edits state, always masks values bound by password, one-time code, payment card and secret fields, and is localized, keyboard and screen-reader accessible. Nothing else in the package imports it, so production bundles leave it out.
