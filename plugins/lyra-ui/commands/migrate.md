---
description: Rename Web Awesome (wa-*) and/or Shoelace (sl-*) usage in a consumer project to lyra-ui (lr-*) equivalents using verified per-source mappings and required warnings
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(grep:*), Bash(git:*)
---

Migrate the project at `$1` (default to the current working directory if `$1` is empty) off Web
Awesome (`<wa-*>`, `@awesome.me/webawesome`) and/or Shoelace (`<sl-*>`, `@shoelace-style/shoelace`)
onto `@aceshooting/lyra-ui`'s `lr-*` equivalents.

Migration is best-effort for both ecosystems. Resolve each occurrence against the source prefix
and installed package version that actually supplied it, then use the corresponding classification
and warnings in `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/migration.md`. Coverage of a
source tag means its mapping is classified; it does not promise an automatic or lossless rename.
Mapped manual and warning-required cases remain manual, including included remote markup and
Shoelace alert listener timing. Installing both libraries does not change an occurrence's source.

Steps:

1. Grep the target path for `<wa-`/`<sl-` tag usages and for `@awesome.me/webawesome`/
   `@shoelace-style/shoelace` import statements (check `package.json` for the exact specifier the
   project actually uses). Build a list of every distinct tag name found, split by source library,
   with file:line references and the installed version of its source package. If neither library is
   present, say so and stop.

2. For each distinct `wa-*` tag, look it up in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/migration.md`. A tag absent from that table has
   no documented counterpart. Then read the target's own
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/components/<lr-tag>.md` for intentional
   differences — do not guess from memory, mirror status and differences are only accurate there.

3. For each distinct `sl-*` tag, use its own Shoelace row in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/migration.md`, regardless of whether Web Awesome
   is also installed. Read the mapped target's `references/components/<lr-tag>.md`. For both
   ecosystems, check every used attribute, slot, event, method, part and CSS custom property against
   the actual source-version mapping and target reference. Apply documented rewrites and preserve
   required warnings; do not infer parity from similar tag names or discard unmatched members.
   Lyra combobox accepts both `clearable` and `with-clear`; neither spelling alone requires a rename.

4. Classify each library's tag list:
   - **Automatic or rewritten** (a verified automatic mapping from step 2 or 3): migrate every
     call site — rename the tag (`wa-button`/`sl-button` -> `lr-button`), update the import
     specifier to the stable tag-shaped registration path
     `@aceshooting/lyra-ui/components/<lr-tag>.js` (the exact **Import** line each
     `references/components/<lr-tag>.md` states), and carry over any attribute/slot/event names
     that differ between the source and lyra-ui per that component's documented differences.
   - **Manual or warning-required**: retain the original occurrence, its exact mapping and warnings
     in the report for manual work. Include keeps its sanitization and same-origin differences;
     Shoelace alert keeps its lifecycle timing and cancellation warning. Do not silently promote
     either to an automatic rewrite.
   - **Unresolved**: leave the original tag in place and list it separately; do not attempt a
     partial migration for a tag with no verified mapping.

5. After editing, grep the target path again for `<wa-`, `<sl-`, and both import specifiers to
   confirm only the reported manual/warning-required and unresolved usages remain.

6. Report, grouped by source library then by component: how many tags were migrated and the exact
   files touched (with a one-line note per component on what, if anything, changed name besides
   the tag), and the full list of what's still `wa-*`/`sl-*` and why. For any remaining `wa-*`,
   suggest the user run `/lyra-ui:update` to check whether a newer lyra-ui release has since closed
   that gap, or file it upstream via that command. For any migrated or remaining `sl-*`, recommend
   a review of the used contracts and remaining warnings. Apply that same review to Web Awesome
   migrations; neither source ecosystem has a blanket automatic-rename guarantee.
