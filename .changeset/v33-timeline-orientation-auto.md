---
'@aceshooting/lyra-ui': major
---

`lr-timeline` accepts `orientation="auto"`, matching Web Awesome's `wa-timeline`. An auto timeline
measures its own inline size and runs as a row while every item gets about 10em of it, and as a
column otherwise, so the same markup stacks on a 320px phone or in a narrow pane with no breakpoint
to author. It renders as a column until it has been measured, including server-rendered markup. The
new read-only `effectiveOrientation` property reports the axis in effect, and while `auto` the host
carries a matching `data-effective-orientation` attribute. A row mirrors under RTL like
`horizontal`.

## Migration

The `orientation` property's type is now `LyraTimelineOrientation`
(`'vertical' | 'horizontal' | 'auto'`), so TypeScript code that switches over it exhaustively, or
assigns it to a `LyraOrientation`, needs an `auto` branch or a read of `effectiveOrientation`
instead. Markup that already set `orientation="auto"` used to fall back to a column and now adapts
to its width; set `orientation="vertical"` to keep the column. `npx lyra-ui-migrate
--origin=lyra-v32 --check` reports each `.orientation` property read, write and binding on an
`lr-timeline`.
