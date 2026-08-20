---
"@aceshooting/lyra-ui": minor
---

`web-types.json` now carries `js.properties`, `js.events` and `slots` alongside its attributes.

It previously declared attributes and nothing else: 0 of 284 tags had properties, events or slots,
while `custom-elements.json` in the same tarball described 1,029 events, 3,102 public fields and 445
slots. 865 of those fields are `attribute: false` and were therefore invisible to JetBrains
completion entirely — and they are frequently the primary API rather than an edge case
(`lr-chart.datasets`, `.labels`, `.config`, `lr-heatmap.legendStops`, `.colorSteps`, `.cellColor`,
`lr-lite-chart.datasets`).

That gap mattered more here than it would for a typical component library: these are Lit components,
so the idiomatic usage is `.prop=${…}` and `@event=${…}` in a template, not attributes. The shipped
metadata covered the minority binding style and omitted the majority.

The web-types schema the file already declared supports all three directly, and the data was already
generated for the manifest, so this was a projection gap rather than missing information. It now
emits every public instance field with its type and default, every declared event with its
`CustomEvent<…Detail>` handler type, and every slot. Static fields and methods are deliberately
excluded (a `.formAssociated=` completion would be wrong, and web-types has no IDE-integrated method
kind).

The sibling `vscode-html-data.json` stays attributes-only, which is correct: the VS Code custom-data
format defines no properties/events/slots concept.
