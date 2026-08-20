---
"@aceshooting/lyra-ui": patch
---

Restored two public property names that were renamed with no alias, no changelog entry and no
deprecation record, silently breaking shipped consumers.

- `<lr-app-rail-item>`: `active` is back as a deprecated alias for `current`, read alongside it —
  the item is current when either is true, in both property and attribute form.
- `<lr-widget>`: `activeView` is back as a deprecated alias for `activeViewId`, which it seeds.

Both were the members' *original* public names. `active` shipped documented as public API ("add an
`active` property that reflects `aria-current="page"` onto the item"), and a later release's notes
still described it as `active` after the rename had already happened. `activeView` never appears in
`CHANGELOG.md` at all, so its rename was never announced in any form.

The breakage was invisible by construction: a Lit `.prop=${…}` binding on a custom element is
untyped, so `.active=${…}` and `.activeView=${…}` did not error — they became dead expandos. No
consumer type check, test suite or build step could see it. One consumer's app rail consequently
had no current-item indicator and a permanent `aria-current="false"` — an accessibility regression
— and its widgets fell back to their first view, with everything still passing.

This is what the house rule about mirrored members already required in general: a rename adds a
second name, it does not swap one out from under shipped consumers. The compatibility window runs
long (`removalNotBefore` two majors out) because these aliases are not new API — they are the names
consumers already wrote.

`activeView` seeds rather than being read alongside, because unlike a boolean flag it is a property
the component itself writes (a view-toggle click, and the fallback when `views` no longer contains
the active id); a read-alongside alias would undo a later interactive change on the next update.
