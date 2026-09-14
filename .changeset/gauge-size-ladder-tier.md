---
"@aceshooting/lyra-ui": minor
---

`<lr-gauge>` gains an opt-in `size` on the library's one six-step size ladder
(`2xs`/`xs`/`s`/`m`/`l`/`xl`, plus the `small`/`medium`/`large` spellings, which are accepted as
authored rather than rewritten to the short form).

The gauge's whole box has always been expressed in `em`, so a tier simply pins the host font size
and the frame, the stroke geometry and both SVG captions step together — `8em` square for
`radial`/`ring`, `12em` by `1.5em` for `linear`, each against that tier's font size.

`size` is genuinely opt-in rather than defaulting to `m`, because a gauge with no tier inherits the
ambient text size: pinning it would silently resize every gauge sitting in a smaller or larger
typographic context. Unset, the component renders exactly what it rendered before this property
existed. An unsupported value normalizes to the omitted state and removes the attribute, so a typo
falls back to that same pre-ladder rendering instead of snapping to a tier nobody asked for.
