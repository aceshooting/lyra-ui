# Component scaffold — lyra-ui agent reference

Use the repository scaffold for a new, peer-free component directory:

```bash
pnpm create:component --family utility --name status-panel
```

`--name` is always the unprefixed kebab-case name. The example creates `lr-status-panel` and
registers it with `defineElement('status-panel', ...)`. The first segment starts with a letter;
later segments may start with a digit, so `--name chart-3d` creates `lr-chart-3d`. Inputs
beginning with `lr-`, `wa-`, or `sl-` are rejected so the command cannot accidentally produce a
doubled prefix or enroll an upstream-branded tag. `--family` must name one of the 11 authored families in
`packages/lyra-ui/scripts/component-families.json`.

## What the command creates

The scaffold writes a sibling class, registration, styles, test, and Storybook story under
`packages/lyra-ui/src/components/<family>/<name>/`. The starter test renders populated slotted
content, asserts the public `base` part and real slot assignment, and runs axe against that
populated state. The story is populated as well; an empty tag is not sufficient coverage.

It also updates the family's source barrel, its authored `llms/<family>.md` reference, the family
directory catalog, the component inventory, and the authored component-metadata assignment. A new
tag enters the `new-component-experimental` profile: it receives the current full package version
as `since` (or `unreleased` while that version is already tagged, until the next version bump) and
full semver protection, but it does not claim stable qualification before review.

After writing, the command regenerates the custom-elements manifest and registration artifacts,
checks family, inventory, registration, and story/test enrollment, then runs the new component's
test in Chromium, Firefox, and WebKit. All writes are transactional. An invalid manifest projection,
metadata result, generator failure, or browser-test failure restores every shared/generated file
and removes only the newly created component directory.

For a secondary tag sharing an existing catalogued component directory, author its matching
`<name>.class.ts` and `<name>.ts` pair and add its maturity assignment to that family's metadata
source. Before the first inventory generation, ownership is derived only when the class's
`@customElement` tag, exported class, registration import and `defineElement()` call agree.
Canonical regeneration validates the family and materializes the inventory; existing inventory
ownership remains authoritative. Missing, ambiguous, cross-family or symlinked source pairs are
rejected. Do not add a fictitious directory entry or edit generated metadata to bootstrap a sibling.

## Validation and follow-up

The command rejects invalid/traversal names and collisions in any of the following sources before
writing: the component directory, family catalog, family barrel, authored docs, component inventory,
component metadata, or current custom-elements manifest.

The generated content surface is deliberately small and valid; it is not a substitute for the
component's approved API and behavior. Replace the starter contract using the normal spec/task
process, keep its JSDoc/tests/story/authored family reference aligned, and rerun the task-specific
three-engine tests. Once the public surface is final, regenerate editor data and the `llms` outputs
in the normal release-gate order documented in [ci-and-gates.md](ci-and-gates.md).
