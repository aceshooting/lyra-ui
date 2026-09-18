---
"@aceshooting/lyra-ui": minor
---

Fix `--lr-icon-button-size-scope` being inert for most consumers.

18.1.0 introduced `--lr-icon-button-size-scope` as the ancestor-scoped icon-button size
input, resolving it as
`var(--lr-theme-icon-button-size, var(--lr-icon-button-size-scope, 2.5rem))`. That order
made the new token dead on arrival for anyone loading the shipped `design-tokens.css`,
which declares `--lr-theme-icon-button-size` on `:root`: a `var()` chain only falls
through when the referenced property is unset **everywhere**, not merely shadowed nearer
the element, so the theme tier always answered first and the subtree override never
resolved. Silently — which is precisely the failure mode the token was added to remove.

The chain now reads the scope input first. That is also the correct precedence on its own
merits: a subtree override should beat an application-wide default. `--lr-icon-button-size`
keeps its element-scoped meaning, the coarse-pointer floor still applies to whichever value
wins, and the resolved default is unchanged at `2.5rem`.

If you worked around this by declaring `--lr-theme-icon-button-size: initial` at `:root`,
that workaround is no longer needed and can be removed.

The library's own tests missed this because their fixtures compose only the base token
layer and never load `design-tokens.css`. A regression test now declares the theme tier on
`:root`, reproducing a real consumer's setup.
