# Structured JSON streams and keyed templates

These experimental helpers use the same versioned view and catalog contracts as the generated
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

This frontend accepts complete version-1 views, not arbitrary tool-call envelopes, JSON Patch,
unframed concatenated documents or a protocol session. It intentionally exposes no partially
validated controls. Model requests and any repair calls remain host-owned.

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
