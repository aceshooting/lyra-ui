# Component scaffold — lyra-ui agent reference

Use the repository scaffold for a new, peer-free component directory:

```bash
pnpm create:component --family utility --name status-panel
```

`--name` is always the unprefixed kebab-case name. The example creates `lr-status-panel` and
registers it with `defineElement('status-panel', ...)`. Inputs beginning with `lr-`, `wa-`, or
`sl-` are rejected so the command cannot accidentally produce a doubled prefix or enroll an
upstream-branded tag. `--family` must name one of the 11 authored families in
`packages/lyra-ui/scripts/component-families.json`.

## What the command creates

The scaffold writes a sibling class, registration, styles, test, and Storybook story under
`packages/lyra-ui/src/components/<family>/<name>/`. The starter test renders populated slotted
content, asserts the public `base` part and real slot assignment, and runs axe against that
populated state. The story is populated as well; an empty tag is not sufficient coverage.

It also updates the family's source barrel, its authored `llms/<family>.md` reference, the family
directory catalog, the component inventory, and the authored component-metadata assignment. A new
tag enters the `new-component-experimental` profile: it receives the current full package version
as `since` and full semver protection, but it does not claim stable qualification before review.

After writing, the command regenerates the custom-elements manifest and registration artifacts,
checks family, inventory, registration, and story/test enrollment, then runs the new component's
test in Chromium, Firefox, and WebKit. All writes are transactional. An invalid manifest projection,
metadata result, generator failure, or browser-test failure restores every shared/generated file
and removes only the newly created component directory.

## Validation and follow-up

The command rejects invalid/traversal names and collisions in any of the following sources before
writing: the component directory, family catalog, family barrel, authored docs, component inventory,
component metadata, or current custom-elements manifest.

The generated content surface is deliberately small and valid; it is not a substitute for the
component's approved API and behavior. Replace the starter contract using the normal spec/task
process, keep its JSDoc/tests/story/authored family reference aligned, and rerun the task-specific
three-engine tests. Once the public surface is final, regenerate editor data and the `llms` outputs
in the normal release-gate order documented in [ci-and-gates.md](ci-and-gates.md).
