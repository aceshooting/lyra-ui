# Archived: Coding conventions

Moved from docs/agents/coding-conventions.md; history before 30.0.0, not current guidance. The
current rule is "`rel` is settable; the `target`-derived guard is not removable" in
[coding-conventions.md](../../agents/coding-conventions.md).

## Why `rel` became settable

This replaces the earlier, stricter rule ("never expose `rel` independently of `target`", still
the shape `app-rail-item.class.ts` uses). That rule was over-broad in both directions: it refused
a same-tab link, which opens no new browsing context and needs no guard at all, and it silently
discarded every `nofollow`/`me`/`license`/`external` written by a consumer migrating from
`wa-*`/`sl-*` — where `rel` is a documented settable property. Because `migrate-wa.mjs` warns at
tag granularity rather than member granularity, that divergence also refused **every**
`<wa-button>`/`<sl-button>` in a migrating app, including ones with no `href` at all.
