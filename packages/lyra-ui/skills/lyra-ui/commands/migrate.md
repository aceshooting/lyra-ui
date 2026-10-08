---
description: Rename Web Awesome (wa-*) and/or Shoelace (sl-*) usage in a consumer project to lyra-ui (lr-*) equivalents using verified per-source mappings and required warnings
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(grep:*), Bash(git:*), Bash(npx:*)
---

Migrate the project at `$1` (default: the current working directory) off Web Awesome (`<wa-*>`,
`@awesome.me/webawesome`) and/or Shoelace (`<sl-*>`, `@shoelace-style/shoelace`) onto
`@aceshooting/lyra-ui`'s `lr-*` equivalents.

Migration is best-effort for both ecosystems. Resolve each occurrence against the source prefix and
the installed package version that supplied it (installing both libraries does not change an
occurrence's source), then use its classification and warnings in
`node_modules/@aceshooting/lyra-ui/llms/migration.md`. A classified mapping is not a promise
of an automatic or lossless rename; manual and warning-required cases (included remote markup,
Shoelace alert listener timing) stay manual.

1. **Inventory.** Grep for `<wa-`/`<sl-` tags and the `@awesome.me/webawesome` /
   `@shoelace-style/shoelace` imports (check `package.json` for the exact specifier). List every
   distinct tag by source library with `file:line` and the installed source version. If neither
   library is present, say so and stop.
2. **Mechanical pass (optional).** `npx lyra-ui-migrate --diff <path>` (or `npx lyra-ui migrate-wa`)
   applies only exact and fully rewritten inventory mappings and reports the rest with
   source-located warnings; `--check` exits nonzero while rewrites or warnings remain. Review its
   diff against steps 3 and 4 rather than trusting it blindly.
3. **Look up each tag** in its own source's row of `migration.md` (a tag absent from the tables has
   no documented counterpart), then read the target's
   `node_modules/@aceshooting/lyra-ui/llms/components/<lr-tag>.md`. Check every used
   attribute, slot, event, method, part and CSS custom property against both; never infer parity
   from similar tag names or drop unmatched members. Lyra combobox accepts both `clearable` and
   `with-clear`; neither alone needs a rename.
4. **Classify and act.**
   - *Automatic or rewritten:* rename the tag at every call site, switch the import to
     `@aceshooting/lyra-ui/components/<lr-tag>.js` (the **Import** line of the component
     reference), and carry over attribute, slot and event differences the reference documents.
   - *Manual or warning-required:* keep the original occurrence and report its mapping and warnings;
     never promote it to an automatic rewrite.
   - *Unresolved:* leave the tag and list it; no partial migration without a verified mapping.
5. **Re-grep** for `<wa-`, `<sl-` and both import specifiers: only reported manual and unresolved
   usages may remain.
6. **Report** by source library then component: tags migrated, files touched, and what changed
   besides the tag name; then everything still `wa-*`/`sl-*` and why. For leftover `wa-*` suggest
   `/lyra-ui:update` (a newer release may close the gap) or filing it upstream; recommend reviewing
   used contracts and warnings for every migrated or remaining occurrence in either ecosystem.
