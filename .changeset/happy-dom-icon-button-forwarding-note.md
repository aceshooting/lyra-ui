---
"@aceshooting/lyra-ui": patch
---

Fix: the seven built-in controls that compose `<lr-icon-button>` for an icon-only action
(`<lr-callout>`, `<lr-dialog>` — inherited by `<lr-drawer>` — `<lr-code-block>`, shared by
`<lr-code-block-core>`, `<lr-message-actions>`, `<lr-reorder-item>`, `<lr-attachment-trigger>`, and
`<lr-copy-button>`) no longer capture a public `--lr-icon-button-*` token on their own `:host` and
re-declare that same public name on the composed part. `<lr-icon-button>` now carries a private
`--_lr-icon-button-<token>-default` fallback tier for every paint token (background/color/border and
their hover/active variants), generalizing the existing `--_lr-icon-button-radius-default` shape;
each composing component sets its own default directly on that private tier instead of the public
one. An ancestor `--lr-icon-button-*` override still wins exactly as before — `<lr-icon-button>`'s
own stylesheet checks the public token first, ahead of any default a composing parent supplies — but
no descendant declares the public name from a private token derived from that same public token
anymore, so a scope-flattening custom-property resolver with no notion of which element declared
what (happy-dom, at least through 20.14.5) no longer sees a cycle: rendering any of the seven
controls under such an environment no longer throws `RangeError: Maximum call stack size exceeded`.
Revises the `llms/shared.md` testing note added in 16.0.0 to match — current versions are
unaffected. No public API changed.
