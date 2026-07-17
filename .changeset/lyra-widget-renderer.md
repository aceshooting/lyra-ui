---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-widget-renderer>`: renders an agent-streamed declarative JSON widget tree through an
allowlisted `type → lyra tag` registry (`card`/`badge`/`button`/`stat`/`result-card`/`result-field`/
`markdown`/`image` built in, plus `row`/`col`/`text` structural built-ins) — unknown types and
disallowed/mistyped props are silently skipped, never rendered, with a deduped dev-mode warning; a
single bubbling `lyra-widget-action` event surfaces actions; streamed updates reconcile keyed by
`id` (or structural path), so a mapped widget's own internal state survives a re-resolve.
`registerWidgetType()` extends the default registry app-side; a per-instance `registry` property
fully overrides it. No `innerHTML`/`unsafeHTML` path exists anywhere in the implementation.
