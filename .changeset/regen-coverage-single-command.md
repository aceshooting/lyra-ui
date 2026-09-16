---
"@aceshooting/lyra-ui": patch
---

Added `pnpm run regen`, a single command that runs every source-artifact generator (manifest,
component inventory, framework types, events, the testing event registry, component metadata,
registrations/tag-aliases, the autoloader manifest, the registration graph, default-string and
translation slices, the three palette generators, design tokens, reservation styles, editor data,
and llms) in real dependency order, so a batch of source changes no longer needs a human to
remember and re-run each generator individually before `pnpm lint`. Added `scripts/check-regen-
coverage.mjs` (wired into `contract-policy` as `check:regen-coverage`/`test:regen-coverage`), a
gate that derives which generators `regen` must reach directly from the freshness gates themselves
— a same-file `--check`/write argument pair, a gate's own `pnpm run <name>` remedy text, or a gate
that imports/references a generator file directly — rather than a hand-kept list, so a newly added
or renamed generator cannot silently fall out of `regen` again. No runtime behavior changed;
`pnpm run regen` on an already-fresh tree is a no-op.
