# Structured JSON streams and keyed templates

These helpers use the same versioned view and catalog contracts as the generated
renderer. They do not execute model-produced scripts, fetch data, grant permissions or invoke
actions. Hosts retain responsibility for transport, data authorization and action dispatch.

## Structured input

`createJsonViewStream({ catalog, limits })` consumes string chunks with `push(chunk)`. The scanner
retains string, escape, delimiter and container state between calls. It scans arriving text
incrementally and checks nesting, member counts, array lengths, value counts and UTF-8 source
bytes without rescanning the retained document after each chunk. A surrogate pair split across
string chunks has the same byte accounting as the joined pair. Network byte streams should first
use a streaming `TextDecoder`; transport decoding remains a host responsibility.

Every `push` result is either `incomplete` or `error`. Even a complete-looking document does not
expose a view until the host calls `finish()`. Finishing performs bounded JSON admission and full
active-catalog view validation. A successful result has `status: 'complete'` and `view`; malformed,
truncated, oversized or unauthorized input has `status: 'error'` and diagnostics. Duplicate decoded
JSON keys reject, including differently escaped spellings of the same key.

`parseJsonView(source, options)` uses the same scanner and finish path. Equivalent batch and
chunked inputs have the same final view, diagnostics, UTF-16 syntax offsets and byte counters.
Schema and view diagnostics retain their JSON Pointers; these semantic diagnostics do not yet
include token-level source maps. `receivedCodeUnits` and `receivedBytes` measure the inspected
prefix when an error stops admission.

`cancel()` discards buffered input and returns a terminal `cancelled` result without a view.
Terminal results are stable: subsequent pushes cannot update a completed, cancelled or failed
stream. Create a new stream for a retry or a replacement generation. The host must also cancel
its transport/provider work; cancelling this parser does not cancel a network request.

This frontend accepts complete version-1 views, not arbitrary tool-call envelopes, JSON Patch
(see `adapters/json-patch.js`), unframed concatenated documents or a protocol session. Model requests
and any repair calls remain host-owned.

Progressive previews are opt in: `createJsonViewStream({ catalog, progressive: true })` (or
`{ minCodeUnits }`) and `createProgressiveMarkupParser({ catalog, surfaceId, revision, progressive })`
(`@aceshooting/lyra-gen/progressive.js`) return a `partial` on some `incomplete` pushes. A partial holds
the complete nodes received so far, with still-open containers closed and listed in `partialNodes`;
an unfinished trailing node or member is left out, never guessed, and every partial passes strict
`validateView`. Partials only grow: a shown node keeps its id and type. A partial carries the surface
and revision the final commit will carry; assign it to `lr-gen-view.partial`, which renders it inert,
fires no `lr-gen-ready` and marks open nodes with the `partial` part, until the committed `document`
arrives. Clear it when the stream fails or is cancelled. A syntax defect stops partials, `finish()`
returns exactly what a non-progressive stream returns, and attempts are spaced at least
`minCodeUnits` (default 128) and a quarter of the consumed input apart, so validation stays linear.

## Prompts, refinement and provider tools

`buildCatalogPrompt(catalog, { format: 'markup' })` asks for one restricted Lyra Markup root instead
of a JSON view and renders the catalog examples in Markup, for hosts that read output with
`parseMarkup()` or `createProgressiveMarkupParser()`. `profile: 'signature'` is an opt-in compact
catalog description; see [catalog presets](catalog-presets.md#prompt-profiles-and-size).

`buildRefinementPrompt(catalog, view, instruction, { nodeId })` asks for one `LyraGenPatch` for
`applyViewPatch()` using the `replace`, `remove`, `insert`, `set` and `move` operations, with the view's
`surfaceId` and `revision` as `expectedRevision`. With `nodeId`, only that node's subtree and the
catalog roles it uses (plus their required children and any `roles` you add) are sent, and the patch
is asked to stay inside that node. The instruction is quoted as data. The runtime still validates
every operation, so a patch that leaves the scope or breaks a bound is rejected like any other.

`applyViewPatch()` also accepts two narrower operations: `{"op":"set","nodeId","prop","value"}`
assigns one property of an existing node (each property once per patch) and keeps its other members
and children, and `{"op":"move","nodeId","parentId","before"?,"after"?}` relocates an existing
non-root node with its subtree, positioned like an insert; a node cannot move inside itself and an
anchor cannot be removed or moved by the same patch. Like every operation, both are checked against
the whole patched view, so a value the catalog rejects or a child type the new parent does not admit
fails (or is isolated with `recovery: 'isolate'`).

```ts
import { buildRefinementPrompt } from '@aceshooting/lyra-gen/prompts.js';
import { createAnthropicTool, createOpenAiTool, createAiSdkTool, estimatePromptTokens } from '@aceshooting/lyra-gen/provider-tools.js';

const refine = buildRefinementPrompt(catalog, view, 'Show memory in GiB.', { nodeId: 'memory-panel', roles: ['gauge'] });
const anthropicTool = createAnthropicTool(catalog);          // { name, description, input_schema }
const openAiTool = createOpenAiTool(catalog, { name: 'show_view' }); // { type: 'function', function: { name, description, parameters } }
const sdkTool = createAiSdkTool(catalog);                    // { description, inputSchema }
const approximate = estimatePromptTokens(anthropicTool.description);
```

The provider helpers place the catalog prompt in the tool description and the view JSON Schema in
the tool input schema; `prompt` and `schema` options pass through to `buildCatalogPrompt()` and
`exportCatalogJsonSchema()`, and `description` replaces the prompt when the host sends it as a
system message instead. Tool names use 1 to 64 letters, digits, `_` or `-`. `createOpenAiTool()`
sets `strict` only when you pass it: strict mode requires every property and accepts fewer schema
keywords than the catalog schema uses. `createAiSdkTool()` has no dependency on the AI SDK; wrap
its `inputSchema` with the SDK's `jsonSchema()` helper. The tool call's input is the generated view;
validate it with `validateView()` as for any other model output. `estimatePromptTokens()` is an approximation for
comparing prompt variants, not a provider tokenizer.

## Repair messages

Validation diagnostics a model can fix carry a short `hint`: the allowed values of an enum, the
expected type and bounds of a value, the missing required property and its shape, the nearest
declared name (within two edits) for an unknown component, property, slot, action, query or state
path, and the owning node for a duplicate identity or an overlapping binding. Hints name only
catalog vocabulary, schema bounds and paths; they never repeat a generated value.

`isRepairableDiagnostic(diagnostic)` reports whether the host may ask a model to fix a failure.
Content-shape failures are repairable: unknown properties and component types, reads of unowned state,
wrong types, out-of-range values and missing required properties, the same set `recovery: 'isolate'`
can contain in place (`REPAIRABLE_DIAGNOSTIC_CODES`; schema failures only for a node's own properties).
Duplicate identities, binding ownership, URL sinks and other content policy, catalog version,
revision, action payload and resource-limit failures stay terminal. Repairable only permits a
request: `createRepairRequest()`, `LyraGenRepairSession` and `repairView()` still validate every
candidate as a whole.

`formatRepairMessage(diagnostics, { maxCharacters, view })` renders diagnostics as a compact,
deterministic repair instruction: grouped by node in document order (view-level failures first),
one line per distinct diagnostic with its code, the path inside the node, the message and the hint,
node ids named when `view` is given, and at most `maxCharacters` UTF-16 code units (default 4000,
clamped to 200 to 32000), ending with a count of omitted errors when the bound is reached.

```ts
import { formatRepairMessage, isRepairableDiagnostic } from '@aceshooting/lyra-gen/repair.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

const checked = validateView(candidate, catalog);
if (!checked.ok && checked.diagnostics.every(isRepairableDiagnostic)) {
  const instruction = formatRepairMessage(checked.diagnostics, { view: candidate, maxCharacters: 1500 });
  // Node "revenue" (/root/children/1):
  // - props.unknown at /props/lable: Property is not declared by the catalog. Hint: Did you mean "label"? Allowed properties: ...
}
```

## Keyed templates

`expandTemplate(template, rows, catalog, { limits, previous })` instantiates a trusted template
against an already authorized JSON data array. A template contains:

- `id`: a stable template identity.
- `key`: a JSON Pointer into each row, selecting a nonempty string or safe integer.
- `root`: a node tree with explicit unique identities and catalog-declared components.
- Optional `values`: mappings from template node identities to `props` and `text` row pointers.

Mappings fill property values or text only. They cannot replace a node identity, component type,
action name, action payload or binding path. Data is literal: a supplied reference-shaped object
is not recursively resolved and confers no host data access. Every materialized instance passes
the active catalog's view validation before the expansion succeeds.

Keys are never inferred from row positions. String and numeric keys remain distinct, and encoding
preserves UTF-16 code units without replacement-character collisions. Keys are limited to 24
UTF-16 code units; the full scoped identity must fit the runtime's 128-character identity limit.
Oversized identities reject instead of truncating or silently renaming them. Length-prefixed
template and node identities prevent delimiter ambiguity between separate template scopes.

Binding pointers are scoped beneath `/_templates/{templateId}/{encodedKey}`. Reordering rows
therefore keeps the same node and state-owner identities. Supply a prior successful expansion as
`previous` to retain the exact immutable node objects for unchanged keyed instances. Updated data
replaces only its instance, while removed instances are listed in `removedNodeIds`. The usual
surface-state reconciliation handles permitted user edits and removes state whose owner vanished.

The result contains `templateId`, ordered `keys`, ordered `nodes` and `removedNodeIds`. A missing
or duplicate key, missing value, invalid mapping, failed catalog validation or exhausted aggregate
budget rejects the entire expansion. The previous expansion remains usable. An empty row array
produces an empty node list; no action or data source is invoked.

Use the normal revision-checked patch API to attach expanded nodes to a surface. Expansion itself
does not mutate an existing document or advance its revision. Final composition must still pass
view validation, including cross-template identities, child relationships and binding ownership.

These helpers establish JSON and local template invariants. They do not establish SSR hydration,
native protocol conformance, a model quality result or browser rendering performance.
