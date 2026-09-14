---
"@aceshooting/lyra-ui": major
---

`<lr-confirm-bar>` can now resolve a decision from a promise, and announces when a decision has
finished rendering. Breaking: `lr-approve`/`lr-deny` carry a new detail field to do it.

- `lr-approve` and `lr-deny` now carry `waitUntil(promise)` in their detail, ExtendableEvent-style.
  Calling it from the listener puts the bar into its `pending` presentation (`loading` on the
  activated control, `disabled` on the other) and the promise's settlement drives the rest: a
  resolution finalizes `decision`, a rejection restores the undecided state and returns focus to the
  control that can retry it. Several `waitUntil()` calls, from one listener or from several, are
  awaited together. This replaces — but does not remove — the imperative dance of calling
  `preventDefault()`, casting `event.currentTarget` to the component type, writing `pending`, and
  then writing `decision` or clearing `pending` by hand; that path still works exactly as before.
  `waitUntil()` called after its own dispatch has finished does nothing and warns in dev mode.
- A listener that resolves the decision itself synchronously still wins outright over both paths,
  `waitUntil()` included. Writing `decision` or `pending` from inside the listener means the
  listener owns the outcome, and the bar applies no bookkeeping of its own.
- New `lr-decision-settled` event, `detail: { decision }`, non-cancelable. It fires after the decided
  `[part="status"]` has rendered and its live-region announcement has been made, on every path that
  reaches a decision — the bar's own, a `waitUntil()` settlement, and a host writing `.decision`
  directly. A host that swaps the bar out for its own result UI can now do it on this event instead
  of having to know that awaiting one `updateComplete` is not enough. A `decision` present in the
  initial markup still announces and settles nothing: it never transitioned.
- `lr-deny`'s detail changes from `null` to `{ waitUntil }`, and `lr-approve`'s from `{ args }` to
  `{ args, waitUntil }`. `args` is unchanged, and `lr-deny` still carries no denial data of its own.
  A listener that asserted on the whole detail object (`detail === null`, or a deep-equality check
  against `{ args }`) needs updating to read the fields it actually uses.
