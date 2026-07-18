---
"@aceshooting/lyra-ui": minor
---

`lyra-activity-feed` gains `renderText?: (entry: ActivityEntry) => TemplateResult`, overriding the
default plain-text `[part="entry-text"]` rendering with arbitrary rich content — rendered markdown,
or markdown plus a trailing tool-call chip list — identically whether or not the feed is currently
virtualized, since both the plain and virtualized paths render every entry through the same
internal template. Previously `ActivityEntry.text` could only ever render as plain escaped text,
with no way to attach richer per-entry content.
