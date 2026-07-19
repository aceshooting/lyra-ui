---
description: Rename Shoelace (sl-*) usage in a consumer project to lyra-ui (lr-*) equivalents (best-effort)
argument-hint: [path]
allowed-tools: Read, Edit, Grep, Glob, Bash(grep:*), Bash(git:*)
---

Migrate the project at `$1` (default to the current working directory if `$1` is empty) off
Shoelace (`<sl-*>` custom elements, `@shoelace-style/shoelace` imports) onto
`@aceshooting/lyra-ui`'s `lr-*` equivalents.

**This is best-effort, not guaranteed mechanical.** `@aceshooting/lyra-ui` only documents a
guaranteed 1:1 API mirror for Web Awesome (`wa-*`); Web Awesome is Shoelace's spiritual successor
by the same author, and the two prefixes usually but not always agree on attribute/slot/event
names. Verify every mapping against the actual component reference rather than assuming
`sl-button` and `wa-button`/`lr-button` are identical.

Steps:

1. Grep the target path for `<sl-` tag usages and `@shoelace-style/shoelace` imports. Build a list
   of every distinct `sl-*` tag name found, with file:line references.
2. For each distinct tag name, first check whether the project also depends on
   `@shoelace-style/webawesome` or already has migration notes mapping its Shoelace usage to Web
   Awesome — if so, treat the Web Awesome mapping as more authoritative and defer to
   `/lyra-ui:migrate-from-wa`'s logic for that tag instead of guessing directly from Shoelace
   naming.
3. Otherwise, look up the closest-named component in
   `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/index.md`, then read its
   `references/components/<lr-tag>.md`. For each attribute/slot/event
   used at each call site, confirm the same name exists on the lyra-ui component's documented API
   before migrating it — if a name doesn't match, check for a renamed equivalent in that file
   rather than dropping or guessing at the attribute.
4. Migrate only the call sites you've verified this way: rename the tag, update the import
   specifier to `@aceshooting/lyra-ui/components/<name>/<name>.js`, and adjust any
   attribute/slot/event names that don't match 1:1.
5. Leave anything you couldn't verify a confident mapping for untouched, and list it separately.
6. Report: what migrated (grouped by component, with a one-line note per component on what, if
   anything, changed name), what's still `sl-*` and why (no confident mapping found), and
   recommend a human review pass on the migrated call sites given the best-effort nature of this
   command — unlike `/lyra-ui:migrate-from-wa`, this isn't a guaranteed-safe rename.
