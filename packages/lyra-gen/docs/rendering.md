# Rendering and cooperative scheduling

`lr-gen-view` admits a complete view and its bound state before preparing its DOM. Invalid
content cannot become a partially rendered form. Admission uses the configured runtime limits;
it is synchronous and is not a streaming validation boundary.

Property bursts share an animation frame. Large admitted trees then prepare across animation
frames, yielding after at most 64 preparation/assembly steps or after a 4 ms elapsed-time check,
whichever comes first. These are cooperative scheduling budgets, not a guaranteed frame duration:
a single trusted constructor, property adapter, property setter or browser DOM operation cannot
be preempted. Keep host adapters bounded and use runtime limits appropriate to the application.

New elements and wholly new subtrees are prepared while disconnected. Existing elements retain
their old properties and children until preparation finishes. The renderer commits retained
properties and keyed child ordering synchronously, then attaches the prepared tree. This final
commit preserves control identity and makes the revision visible together; its work grows with
the retained or moved nodes. It is not split across frames, so this mechanism does not establish
a universal input-latency or paint-time guarantee.

While a replacement is preparing, the previous rendered tree remains visible. Compatible bound
input edits invalidate pending preparation and retain their dirty values in the replacement.
Focus and native selection remain on retained controls; necessary reorders restore focus without
scrolling. Actions, form submission and reset wait until the current revision commits, so an old
visible button cannot request an action using a new revision. Nodes removed or replaced by the
committed revision no longer publish renderer events.

Replacing the document, catalog, binding state, limits or locale invalidates stale preparation.
Disconnection cancels pending animation-frame work and settles its update promise; reconnecting
prepares the latest admitted view. Trusted module promises themselves are not canceled, but
obsolete completions cannot publish readiness. Host property adapters receive the effective
locale as their optional second argument, and locale changes invalidate cached prepared values.
The returned property record is shallow-copied and frozen before its content-policy checks; later
host mutations cannot replace the admitted top-level values while preparation is pending.

`updateComplete` includes the current DOM preparation and commit, and follows Lit's superseded
update behavior. It does not wait for arbitrary child asynchronous work. Use `status`, `busy` or
`lr-gen-ready` for readiness: ready requires encountered component loaders and generated child
updates to settle after commit. Child-owned remote data and media loading are outside this
boundary. A failed loader or child update produces error state, never a ready event.

The browser regressions exercise real animation frames, detached construction, atomic visible
replacement, input edits during preparation, focus and form identity, supersession, disconnect,
invalid trailing nodes and child-update readiness. They establish those scheduling and behavior
contracts; workload latency and long-task results require separate measurements.
