---
"@aceshooting/lyra-ui": minor
---

Publish a generated `registrations.json` artifact describing which `<lr-*>` tags each stable
per-tag entry registers as a side effect. Importing `@aceshooting/lyra-ui/components/lr-table.js`
also registers `<lr-empty>`, `<lr-pagination>`, `<lr-skeleton>`, and `<lr-spinner>`, because
`lr-table`'s registration entry imports those composed children's own registration entries before
defining `<lr-table>` itself; nothing published previously described that, so verifying it
statically meant parsing the shipped minified JavaScript for import specifiers and
`defineElement(...)` call literals. `registrations.json` reads `{ schemaVersion: 1, entries: [{
tag, entry, registrationModule, registers }] }` for every published component, derived by
`scripts/generate-registration-graph.mjs` from the same transitive-import analysis
`scripts/check-component-dependencies.mjs` already performs, rather than a second hand-maintained
list.
