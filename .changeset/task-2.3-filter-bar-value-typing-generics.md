---
'@aceshooting/lyra-ui': minor
---

`<lr-filter-bar>` is now generic on its `filters` schema, so TypeScript narrows `value` per `filterId`

`LyraFilterBar<Defs extends readonly LyraFilterBarFilterDefinition[]>` narrows `value` (and the
`lr-input`/`lr-reset` detail `value`) to a keyed record whose per-`filterId` field type follows
that filter's own definition: a `'select'`, a non-`multiple` `'combobox'`, `'text'`, `'date'`, and
`'date-range'` type as `string`; a `'checkbox-menu'` and a `multiple: true` `'combobox'` type as
`readonly string[]`; a `'custom'` filter keeps the full unconstrained field value, since its
adapter may use either boolean meaning. Declare the schema with `as const satisfies readonly
LyraFilterBarFilterDefinition[]` and type the element as `LyraFilterBar<typeof FILTERS>` to pick
it up. The narrowed shape is also exported standalone as `LyraFilterBarValueFor<Defs>`, and the
value-carrying events as the stable per-event aliases `LyraFilterBarInputEvent<Defs>`/
`LyraFilterBarResetEvent<Defs>`, so a handler can name one event's type without restating the
detail shape.

This is types only: the runtime is entirely unchanged. The type parameter defaults to `readonly
LyraFilterBarFilterDefinition[]`, so an untyped `<lr-filter-bar>` — including everything reached
through `document.querySelector('lr-filter-bar')` — keeps exactly today's `LyraFilterBarValue`
record and compiles unchanged.

Migration tip (not required): a project that already carried its own per-`filterId` casts when
reading `value` off a filter bar with a fixed schema can delete them and let the generic narrow
instead; its own linter may now flag the old cast as unnecessary.
