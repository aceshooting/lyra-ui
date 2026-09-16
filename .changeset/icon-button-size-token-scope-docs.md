---
"@aceshooting/lyra-ui": patch
---

Docs: corrected the token-scope contract for `--lr-icon-button-size`, `--lr-otp-input-segment-size`,
and `--lr-popover-viewport-clamp`. All three read like ordinary per-component
`--lr-<component>-*` tokens, but the shared base token layer (`internal/tokens.styles.ts`) declares
each of them on its own `:host` block, which every `lr-*` component includes -- so, like
`--lr-focus-ring-width`/`-color`/`-offset`, a rule that sets one of them on an ancestor is reset at
the first intervening `lr-*` component and never reaches a nested target. This was always the
behavior (and is already asserted by `internal/tokens.test.ts`); the docs previously implied all
`--lr-icon-button-*`/`--lr-otp-input-*` tokens inherit uniformly from an ancestor, which is true for
every other one of them (e.g. `--lr-icon-button-radius`/`-background`) but not these. Updated
`lr-icon-button`'s and `lr-otp-input`'s own `@cssprop` JSDoc, the icon-button and otp-input entries
in `llms/forms.md`, and the design-token overview built by `scripts/build-llms.mjs`
(`llms/tokens.md`) to state the general rule once and name the affected tokens; added test coverage
proving the asymmetry against a nested shadow root. No runtime behavior changed and no token was
renamed.
