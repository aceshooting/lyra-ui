---
"@aceshooting/lyra-ui": patch
---

The migration codemod now warns about four classes of `wa-*`/`sl-*` reference it does not rewrite,
instead of leaving them silent: tag selectors inside a `` css`` `` tagged template, `::slotted()`,
DOM selector strings reached through `this`/`this.shadowRoot`, and `--wa-*`/`--sl-*` custom
properties.

Each of these fails silently at runtime after a migration — a CSS rule keyed on a tag that no
longer exists matches nothing, `::slotted()` likewise, `querySelector` returns null, and a `var()`
naming a removed token falls back to its second argument or to nothing. Nothing throws, nothing
fails a build, and a typechecker cannot see inside a template literal. Because `--check` is
documented as a CI gate, the silence meant CI certified a migration that had visibly broken the
component's styling.

Tokens are deliberately reported rather than rewritten: the two spacing scales are offset by one
step (Web Awesome `m` is 1rem, Lyra `m` is 0.75rem), so renaming by name alone silently tightens
every gap, while mapping by value has no target for 1.5rem or 2.5rem. Warnings are filtered against
the rewrites the same pass produced, so a reference the inventory does map is never both rewritten
and warned about, and a self-declared `--wa-*` property (the consumer's own, merely sharing the
prefix) is exempt.

`<lr-dialog>`'s docs also now warn that `lr-close` is not a dialog-scoped name — nine components
emit it, several of which are routinely nested inside a dialog, and library events bubble and are
composed, so a listener bound on the dialog also receives a descendant's close.
