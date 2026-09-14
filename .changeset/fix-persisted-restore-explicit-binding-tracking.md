---
"@aceshooting/lyra-ui": patch
---

`<lr-app-rail>` actually restores a persisted `open` state again, and `<lr-table>` stops overwriting
a `priorityColumnsVisible` binding that pins the columns hidden.

Both bugs come from the same question a `storage-key` component has to answer before it restores
anything: did the consumer set this property, or is it still sitting on its declared default? Only
the second may be overwritten.

- **`<lr-app-rail>`:** the `open` restore was gated on whether Lit had recorded a change for `open`
  during the first update. Lit records a declared default there as well, so the gate was closed on
  every mount and a persisted `open` was never restored at all — silently, for every rail using the
  default `persist="open width"` allowlist. `open` (and `rail-width-px` and `preferred-mode`
  alongside it) now track whether the property was actually assigned, so a stored `open` state is
  applied on the next mount, and no `lr-toggle` fires for it — a restore is not a user action.
  Worth knowing if you relied on the broken behaviour: a rail left open at the mobile breakpoint is
  now open again on the next mount — but only on a mount whose breakpoint-derived `mode` is already
  `'mobile'`, the one mode `open` means anything in. Reopen the same page at a desktop width and the
  stored `open` is dropped instead of sitting there primed to throw a focus-trapping overlay over
  the page the first time the viewport narrows. `persist="width preferred-mode"` keeps the layout
  preference and leaves the transient overlay out of storage, exactly as its documentation already
  described.
- **`<lr-table>`:** the `priority-columns-visible` restore was gated on the property's own current
  value ("still `false`, so nobody set it"). That cannot see a binding that deliberately assigns the
  default, so `.priorityColumnsVisible=${false}` — a host pinning the priority columns hidden — was
  overwritten on mount by a stale stored `true`. An explicit binding now wins, whichever value it
  carries.

Unchanged in both: an explicit binding or a parse-time attribute still beats stored state; a
component with no `storage-key` still touches storage neither to read nor to write; the restore
still happens once, before the first paint, and never re-runs on a reconnect.

`<lr-widget>`'s `collapsed` restore already tracked assignments correctly and behaves exactly as
before; it now shares the mechanism rather than keeping its own copy of it. That includes the
timing: `collapsed` still writes its reflected `[collapsed]` attribute during the assignment, so a
`lr-collapse-change` listener reading the attribute still sees the state the event announced.
