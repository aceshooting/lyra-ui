---
description: Rename Web Awesome (wa-*) usage in a consumer project to lyra-ui (lyra-*) equivalents
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(grep:*), Bash(git:*)
---

Migrate the project at `$1` (default to the current working directory if `$1` is empty) off Web
Awesome (`<wa-*>` custom elements, `@awesome.me/webawesome` imports) onto
`@aceshooting/lyra-ui`'s `lyra-*` equivalents. `@aceshooting/lyra-ui`'s own docs guarantee this is
a **mechanical rename** for any component that has a documented Web Awesome counterpart — see
`${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/llms-full.txt`, where each component's section
states whether it mirrors a `wa-*` component 1:1.

Steps:

1. Grep the target path for `<wa-` tag usages and for `@awesome.me/webawesome` (or whatever import
   specifier the project actually uses — check its `package.json`) import statements. Build a list
   of every distinct `wa-*` tag name found, with file:line references.
2. For each distinct tag name, look it up in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/llms-full.txt` (search for a "Web Awesome
   mirror" or equivalent note in that component's section). Do not guess from memory — the mirror
   status and any documented intentional differences are only accurate in that file.
3. Split the list into two buckets:
   - **Mirrored** (lyra-ui documents a `lyra-*` equivalent): for every occurrence, rename the tag
     (`wa-button` -> `lyra-button`, etc.), update the import specifier to
     `@aceshooting/lyra-ui/components/<name>/<name>.js`, and carry over any attribute/slot/event
     names that differ between the two per that component's documented differences (do not assume
     every attribute name is identical — check the reference).
   - **Not mirrored**: leave the `wa-*` usage in place and list it separately in the final report —
     do not attempt a lossy or partial migration for a component with no documented lyra-ui
     equivalent.
4. After editing, grep the target path again for `<wa-` and `@awesome.me/webawesome` to confirm
   only the "not mirrored" bucket's usages remain.
5. Report: how many tags were migrated (grouped by component), the exact files touched, and the
   full list of any `wa-*` usages left behind because lyra-ui has no equivalent yet — suggest the
   user run `/lyra-ui:update-lyra` to check whether a newer lyra-ui release has since closed that
   gap, or file it upstream via that command.
