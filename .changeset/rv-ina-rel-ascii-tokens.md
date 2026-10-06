---
"@aceshooting/lyra-ui": major
---
`rel` on link-capable components (`lr-button`, `lr-icon-button`, `lr-card`, `lr-menu-item`, `lr-breadcrumb-item`, `lr-navigation-menu-item`) is now split into tokens on ASCII whitespace only, exactly as browsers read `rel`. Previously a no-break space (or other Unicode whitespace) also separated tokens, so `rel="nofollow ugc"` rendered two tokens; it now renders the author's single token, which the browser treats as one unknown value. Migration: separate `rel` tokens with ordinary spaces. The `opener` stripping and the `noopener noreferrer` guard for a set `target` are unchanged.
