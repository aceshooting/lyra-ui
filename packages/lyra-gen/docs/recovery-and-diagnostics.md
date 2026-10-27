# Explicit completion and local failure categories

Strict JSON and Lyra Markup parsing reject incomplete input by default. Neither the renderer nor
the streaming parsers silently complete source or coerce data. The host can separately opt into
the narrow JSON policy below after its transport has reached EOF.

## JSON envelope completion

`completeJsonView(source, catalog, options?)` first calls the bounded `parseJson()` parser and
validates any complete view against the active catalog. Complete valid input returns
`{ view, source, completion: 'none' }`; complete invalid input remains a failure.

The default `policy: 'reject'` leaves incomplete input rejected. An explicit
`policy: 'close-envelope-eof'` can append exactly one final top-level object brace, `}`. The
existing source must begin with an object and end, apart from whitespace, in an already closed
object or array. The appended candidate must pass the same bounded parser and full catalog view
validation. Both the original source and the appended candidate use the supplied `limits`.

For example, a complete root node inside a view whose final envelope brace is missing can be
completed. A missing root-node brace, unfinished string or number, incomplete member, trailing
comma, missing array delimiter, or incomplete markup tag is rejected. The policy adds no content,
changes no existing token and does not infer what additional content a model might have intended.
It is an explicit host decision to accept that already complete content as the final view.

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { completeJsonView } from '@aceshooting/lyra-gen/recovery.js';

const result = completeJsonView(receivedSource, initialCatalog, {
  policy: 'close-envelope-eof',
  limits: { maxBytes: 262144 },
});
if (result.ok) {
  generatedView.document = result.value.view;
  // Retain result.value.source and completion when recording an explicitly completed input.
}
```

Successful completion returns `completion: 'closed-envelope'` and a warning diagnostic
`recovery.envelope-closed` at the original EOF insertion point. It does not change the surface ID,
node IDs, revision, actions, bindings or property values. It does not call a model or advance a
live surface revision. Existing revision and ownership checks still apply when assigning the view.

There is no coercion policy: booleans and numbers remain their supplied types, enum values must
match exactly, and missing members remain missing. Duplicate keys, duplicate or missing IDs,
unknown actions or catalog members, prototype-related keys, and resource-limit failures reject
their boundary. The helper never renames identities, selects a nearby enum, finishes an attribute,
closes markup tags, or broadens repair authority. Content repair remains separately scoped through
`createRepairRequest()` and `LyraGenRepairSession`.

## Local failure categories

Set the renderer's optional `.failureCategories` callback to observe coarse local failure categories:

```ts
import type { LyraGenFailureCallback } from '@aceshooting/lyra-gen/diagnostics.js';

const onFailure: LyraGenFailureCallback = categories => {
  localFailureIndicator.categories = categories;
};
generatedView.failureCategories = onFailure;
```

The callback receives only a frozen, unique array drawn from this fixed ordered vocabulary:
`syntax`, `identity`, `security`, `budget`, `catalog`, `accessibility`, `validation`, `lifecycle`,
`internal`. It receives no source, messages, diagnostic codes, paths, identifiers, values, timings
or per-category counts. Unknown codes map to `internal`. Classification inspects data properties
without invoking diagnostic getters and processes at most 100 diagnostics per call.

`notifyFailureCategories(diagnostics, callback?)` exposes the same policy for host-owned error
boundaries. `summarizeFailureCategories(diagnostics)` returns just the frozen category array.
The library makes no network request, stores no reports and installs no telemetry. Any further
handling is application-owned. Omitting the callback changes no rendering, status, validation,
action or `lr-gen-error` behavior. Throwing callbacks and rejected callback promises are isolated;
the library does not await them or use their return values to decide how to render.

## Error isolation

Strict rejection is the default. Pass `recovery: 'isolate'` to contain a defect that is local to one
component instead of rejecting the whole view. The option is accepted by `validateView`,
`applyViewPatch`, `completeJsonView`, `parseJsonView`/`createJsonViewStream`, the AI SDK bridge, the
chat controller (`LyraGenChatOptions.recovery`) and the `recovery` property or attribute of
`<lr-gen-view>`. Any value other than `'isolate'` behaves as strict.

In isolate mode the outermost failing node and its subtree are replaced in place by
`{ id, type: LYRA_GEN_ISOLATED_TYPE }` (`'lyra-gen:isolated'`, reserved: generated input can never
use it). The result is `ok: true`, carries `isolated` (`nodeId`, `path`, `diagnostics`) and repeats
the diagnostics as warnings, so failure-category callbacks still fire; check `isolated`, not the
diagnostic count. Only component-local codes (unknown role, property and schema value errors under
`/props`, text, slot, member, child type, accessible name) are contained. Identity, binding,
action, URL and sink policy, nesting and resource-limit failures, and any failure at the root
reject the whole document exactly as strict mode does.

`<lr-gen-view>` renders each marker as a non-interactive element with part `isolated`,
`role="group"` and the localized `genViewInvalid` text; unaffected nodes keep their state, focus and
actions, and no action is emitted for a marker. A chat island whose defects were contained stays
`ready` and lists them in `LyraGenChatIsland.isolated`.

An isolated view is accepted again only as the very object that was returned; a JSON copy carries the
reserved type and is rejected. Persist the original input and isolate again when loading.

## Host-owned asynchronous repair

The granular `repair-workflow.js` module exports `repairView()`. It validates the current view,
rejects identity, catalog, authority and resource failures, then sends the declared failing nodes
and their content diagnostics to a host transport. Every selected node must contain a failure;
selected regions cannot overlap, and all current failures must fall within those regions. The
request includes no unrelated siblings, complete surface tree or local state. A selected parent
includes its subtree, so choose the smallest failing region that supplies sufficient context.

The host supplies `getCurrent()` returning `{ view, state?, generation }`. Advance `generation`
on every user edit and new model request, including edits that do not advance the view revision.
The workflow also compares the complete admitted view and state before and after each transport
call. A changed generation, revision, value, dirty marker or node rejects the stale result. A
successful result contains a fully validated candidate view, reconciled state if supplied,
original generation, attempt count and actual transport token usage. It performs no assignment.
Commit the candidate synchronously only while that generation remains current; an asynchronous
host commit needs its own atomic generation comparison.

The transport signature is `(request, { signal, attempt, maxTokens }) => Promise<{ patch,
tokensUsed }>`. `tokensUsed` must report actual total request and response usage. Missing,
fractional, negative or over-budget usage rejects the result. The library cannot independently
measure provider usage or force a provider to honor a token limit; configure that provider's
request limit using the supplied remaining budget. All requests, retries and credentials remain
host-owned. No provider is imported or contacted by this helper.

```ts
import { repairView } from '@aceshooting/lyra-gen/repair-workflow.js';

const repaired = await repairView({
  getCurrent: () => ({ view: currentView, state: currentState, generation }),
  catalog,
  nodeIds: ['invalid-field'],
  signal: cancellation.signal,
  limits: { maxAttempts: 2, maxElapsedMs: 10_000, maxTokens: 2048 },
  transport: hostRepairTransport,
});
if (repaired.ok && repaired.value.generation === generation) {
  currentView = repaired.value.view;
  currentState = repaired.value.state;
}
```

Defaults are two attempts, 30 seconds and 4096 tokens; hard ceilings are three attempts, 60
seconds and 16384 tokens. The deadline includes validation and reconciliation. Cancellation or
the deadline aborts the transport signal and resolves even when transport ignores cancellation.
Late transport resolution never merges, and late rejection remains handled. Invalid content may
be retried within the remaining budget; security, identity and scope failures terminate. Dirty
bindings retain their owners and edited values; repair cannot erase them by replacing a node.

The following is a deterministic fake transport for local orchestration tests only. Its zero
usage means that no tokenizer or provider ran; it supplies no evidence of model repair quality.

```ts
import type { LyraGenRepairTransport } from '@aceshooting/lyra-gen/repair-workflow.js';

const fakeTransport: LyraGenRepairTransport = async (request, { signal }) => {
  signal.throwIfAborted();
  const node = request.nodes[0]!;
  return {
    patch: {
      surfaceId: request.surfaceId,
      expectedRevision: request.expectedRevision,
      operations: [{
        op: 'replace', nodeId: node.id,
        node: { ...node, props: { ...node.props, label: 'Example accessible label' } },
      }],
    },
    tokensUsed: 0,
  };
};
```

These local fixtures qualify budget, scope, cancellation and stale-state behavior. Provider-backed
success rates and token efficiency still require an explicit, separately recorded evaluation.
