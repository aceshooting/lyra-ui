---
"@aceshooting/lyra-ui": patch
---

`lr-checkbox-group`: document `value` as a read-out of child state, and warn on the two ways it is
misused.

`value` shipped with no documentation at all while the generated docs listed it among settable
properties, so it read as an input. It never was one: `sync()` recomputes it from the
`<lr-checkbox>` children and assigns it on every child toggle, `slotchange`, `name`/`required`
change, blur and `form.reset()` — and `connectedCallback()` syncs *before the first render*, so even
a constructor-time or template-time `.value=` binding is discarded before it is ever observed. It
now carries that contract in its JSDoc, and:

- assigning `value` from outside logs a `console.warn` naming the property and pointing at `checked`
  on the children (once per element — a repeat assignment is the same mistake, not new information);
- a group with two or more children sharing a `value` logs a `console.warn` too. This is the *easy*
  mistake, not an exotic one: `<lr-checkbox>`'s `value` defaults to `'on'`, so five undifferentiated
  children yield `['on','on','on','on','on']` and a `FormData` that cannot say which was checked.

Both warnings follow the same plain-`console.warn` shape as the library's other authoring-mistake
warnings (`lr-task-list` over-nesting, `lr-dashboard-grid` unmatched `cell-id`, `lr-flow-canvas`
unrecognized child). No behavior changed for the normal children-drive-value flow, which warns not
at all.

`value` was deliberately **not** made authoritative. Push-down is unimplementable without surprise
while children default to `value = 'on'` (a host assigning `['on']` would check every
undifferentiated child), and it would additionally need a re-entrancy guard and a pending-value
retention path for children that have not upgraded yet. Recorded here so a later release can add a
distinct `defaultValue` API without reversing anything documented now.
