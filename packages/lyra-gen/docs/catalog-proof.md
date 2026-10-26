# Catalog contract checks

Run `pnpm --filter @aceshooting/lyra-gen check:catalog` after building the companion. The check
compares the reviewed catalog with the current component manifest and TypeScript source, including
public properties, required members, literal defaults, enum values, slots, events and granular
loaders. Authored examples pass the same view validator used by the renderer.

Three properties require a more specific contract than the uninstantiated component class:

| Property | Checked contract |
| --- | --- |
| `select.value` | `LyraSelect<false>['value']`, with the actual single-selection default verified and neither a `multiple` overlay property nor a mode-changing adapter admitted. |
| `table.rows` | `LyraTable<Row>['rows']`, where `Row` permits the sixteen canonical keys and only string, number, boolean or null cells. |
| `table.columns` | Serialized column fields checked against the concrete table column type with `cell` excluded. The adapter's prepared column shape, including its callback, must be assignable to the complete component column type. |

The real table adapter is also exercised with all sixteen keys, ten scalar/missing-row cases,
five formatting configurations and English, French and Arabic locales. Checks require preserved
values and column metadata, removed serialized `format`, text-returning cell callbacks and no
accessor or inherited-property reads. Negative tests demonstrate rejection of incompatible
schemas and malformed adapter results. This is a bounded adapter cohort, not a proof about every
possible JavaScript callback or arbitrary host-selected generic type.

# Export schema profiles

`catalog-export-cohort.test.mjs` validates separate stable and candidate artifacts against the
schemas pinned in `test/fixtures/a2ui/`. It covers every authored catalog example, unknown properties,
missing required properties, scalar select values, and the stable-only dynamic binding profile.
The JSON Schema validator resolves the common vocabulary's `catalog.json` reference to the
host-selected exported catalog. Format annotations are not asserted; structural and value
constraints are checked. Candidate schema acceptance does not qualify candidate message processing,
rendering, actions, or interoperability with an untested consumer.

The source-pinned consumer cohort additionally loads each artifact with upstream `Catalog.fromJson`,
checks every component property case, and requires an exact JSON round trip. Reproduce it with:

```sh
node scripts/check-catalog-consumer.mjs --reference /path/to/pinned-a2ui \
  --dependencies /path/to/pinned-reference-dependencies --output catalog-results.json
```

The dependency directory must contain the exact versions and npm integrity records recorded in
`test/fixtures/a2ui/v0.9.1/reference-results.json`. The command verifies the clean reference revision,
bundles the unmodified catalog consumer in disposable scratch, and records source, artifact and
compiler hashes. It performs no installation or network access. See
[`catalog-export-results.json`](../test/fixtures/a2ui/catalog-export-results.json) for the separate
stable and candidate outcomes. These are catalog-loader checks, not reference renderer or protocol
conformance results.

Candidate v1 role identifiers replace hyphens with underscores: `chat-message` becomes
`chat_message`. Component constants, child-role constraints and schema references use the same
mapping. Invalid identifiers, mapping collisions and unknown child roles reject the export;
property names are validated and retain their spelling. Stable v0.9.1 identifiers are unchanged.
The candidate artifact still contains literal properties only and advertises no supported protocol
processor or renderer.

# Rendered theme contrast

`test/browser/theme-contrast.test.ts` covers 36 combinations: the base Lyra look and five authored
look profiles, resolved light/dark modes, and compact/comfortable/touch density. Each renders a
320px solid-surface generated report with text, a labelled input, an action button, and a grouped
bar chart containing all eight categorical series over two categories. Computed surface colors
and density settings are checked against the authored token definitions before measuring contrast.

The cohort checks normal text at 4.5:1 and separated bar marks against their plot background at
3:1, using the shared rendered-color helpers. Every series retains its mark names, matching legend,
and visible table with exact labelled values, so color is not the only available representation.
These checks follow [text contrast](https://www.w3.org/TR/WCAG22/#contrast-minimum),
[non-text contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast), and
[use of color](https://www.w3.org/TR/WCAG22/#use-of-color); they impose no pairwise 3:1 requirement
between separated series colors.

This is a bounded automated composition check. Line charts, arbitrary host colors, translucent
backdrops, interaction states, forced colors, screenshots, and human visual or assistive-technology
review require separate qualification. System and unset modes resolve to light or dark; their
selection behavior is covered by the UI theme tests.
