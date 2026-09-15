---
"@aceshooting/lyra-ui": minor
---

The shared icon-button tappable-target floor (`--lr-icon-button-size`, and the form-control size
ladder's own per-tier heights) now grows to the platform touch-target convention (2.75rem/44px)
under a coarse pointer (`@media (hover: none), (pointer: coarse)`), regardless of what an ancestor
set the ordinary floor to. Both rules live in one place each — `internal/tokens.styles.ts`'s
`baseTokens` for `--lr-icon-button-size`, `internal/sizes.styles.ts` for the ladder's
`--lr-form-control-height` — so every one of the library's icon-only controls and every ladder
consumer (`lr-button`, `lr-input`, `lr-select`, `lr-combobox`, ...) is covered without touching each
component's own stylesheet, and no default rendering changes on an ordinary (fine) pointer.

This is the safety net behind a pattern that already worked but was undiscoverable: lowering
`--lr-theme-icon-button-size` (never `--lr-icon-button-size` itself, which every `LyraElement`
re-declares on its own `:host` and so never reaches a composed child — see
`internal/tokens.test.ts`) on an ancestor shrinks every icon-only control beneath it below the
ordinary 2.5rem/40px floor, for a dense action row that a mouse-only layout can't otherwise afford.
`<lr-copy-button>` and `<lr-message-actions>` — named in the request this closes — now document that
override path, plus the equivalent `::part(base__control)` /
`::part(regenerate-button__control)`/`::part(edit-button__control)` direct overrides, explicitly in
their own class doc and in `llms/utility.md`/`llms/conversation.md`. With the coarse-pointer floor
in place, that shrink is now safe to ship: whatever a dense-row layout lowered the floor to on a
fine pointer, the rendered hit area still floors at 2.75rem/44px the moment the pointer reaching it
is a finger rather than a mouse.

An ancestor density switch and a per-component `size`/`compact` property were both considered and
declined for this request: the token- and part-level overrides above already reach the same result
without inventing a second sizing system on top of the library's one six-step ladder.
