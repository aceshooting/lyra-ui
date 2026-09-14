---
"@aceshooting/lyra-ui": minor
---

`<lr-switch>` gains `--lr-switch-checked-track-border`, so a bordered track can differ when
checked.

`--lr-switch-track-border` already let a consumer add a rim to `[part="track"]`, but that rim was
the same in both states — varying it meant reaching past the token vocabulary for
`lr-switch:state(checked)::part(track)`. The new hook completes the pair, mirroring the shape
`--lr-switch-checked-thumb-fill` and `--lr-switch-checked-label-color` already use: it falls back
to `--lr-switch-track-border`, which itself falls back to no border at all, so an unset consumer
renders byte-identically to before and a consumer who only sets the resting border keeps getting
that border in both states. It takes a whole `border` shorthand value, like its resting sibling.
Give both states the same border *width* unless a size change between them is what you want — the
track is `box-sizing: content-box`, so a border grows its outer footprint.
