---
description: Rename Web Awesome (wa-*) and/or Shoelace (sl-*) usage in a consumer project to lyra-ui (lr-*) equivalents (mechanical for wa-*, best-effort for sl-*)
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(grep:*), Bash(git:*)
---

Migrate the project at `$1` (default to the current working directory if `$1` is empty) off Web
Awesome (`<wa-*>`, `@awesome.me/webawesome`) and/or Shoelace (`<sl-*>`, `@shoelace-style/shoelace`)
onto `@aceshooting/lyra-ui`'s `lr-*` equivalents.

**wa-\* is a guaranteed mechanical rename**: `@aceshooting/lyra-ui`'s own docs commit to a
documented 1:1 API mirror for any Web Awesome component that has one — see
`${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/migration.md`. **sl-\* is best-effort, not
guaranteed**: lyra-ui only documents a guaranteed mirror for Web Awesome (Shoelace's spiritual
successor, same author); the two prefixes usually but not always agree on attribute/slot/event
names. Verify every sl-* mapping against the actual component reference rather than assuming
`sl-button` and `wa-button`/`lr-button` are identical.

Steps:

1. Grep the target path for `<wa-`/`<sl-` tag usages and for `@awesome.me/webawesome`/
   `@shoelace-style/shoelace` import statements (check `package.json` for the exact specifier the
   project actually uses). Build a list of every distinct tag name found, split by source library,
   with file:line references. If neither library is present, say so and stop.

2. For each distinct `wa-*` tag, look it up in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/migration.md`. A tag absent from that table has
   no documented counterpart. Then read the target's own
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/components/<lr-tag>.md` for intentional
   differences — do not guess from memory, mirror status and differences are only accurate there.

3. For each distinct `sl-*` tag: first check whether the project also depends on
   `@awesome.me/webawesome`/`@awesome.me/webawesome-pro`, or already has migration notes mapping
   its Shoelace usage to Web Awesome — if so, treat that Web Awesome mapping as more authoritative
   and resolve it with step 2's logic instead of guessing directly from Shoelace naming. Otherwise,
   look up the closest-named component in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/index.md`, then read its
   `references/components/<lr-tag>.md`. For each attribute/slot/event used at each call site,
   confirm the same name exists on the lyra-ui component's documented API before migrating it — if
   a name doesn't match, check for a renamed equivalent in that file rather than dropping or
   guessing at the attribute.

4. Split each library's tag list into two buckets:
   - **Mirrored/mapped** (a confidently-verified `lr-*` target from step 2 or 3): migrate every
     call site — rename the tag (`wa-button`/`sl-button` -> `lr-button`), update the import
     specifier to the stable tag-shaped registration path
     `@aceshooting/lyra-ui/components/<lr-tag>.js` (the exact **Import** line each
     `references/components/<lr-tag>.md` states), and carry over any attribute/slot/event names
     that differ between the source and lyra-ui per that component's documented differences.
   - **Unresolved**: leave the original tag in place and list it separately — do not attempt a
     lossy or partial migration for a tag with no confidently-verified mapping.

5. After editing, grep the target path again for `<wa-`, `<sl-`, and both import specifiers to
   confirm only the unresolved bucket's usages remain.

6. Report, grouped by source library then by component: how many tags were migrated and the exact
   files touched (with a one-line note per component on what, if anything, changed name besides
   the tag), and the full list of what's still `wa-*`/`sl-*` and why. For any remaining `wa-*`,
   suggest the user run `/lyra-ui:update` to check whether a newer lyra-ui release has since closed
   that gap, or file it upstream via that command. For any migrated or remaining `sl-*`, recommend
   a human review pass regardless of outcome — that path is best-effort, not the guaranteed-safe
   rename `wa-*` gets.
