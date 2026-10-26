# Versioned A2UI processing

`@aceshooting/lyra-gen/adapters/a2ui.js` contains a Lyra-owned processor. It has no
upstream processor runtime dependency. Its stable schema baseline is the official
[`specification/v0_9_1` directory at revision
`409ded29ccac3eebc541979ae5320771703248e8`](https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8/specification/v0_9_1).
That schema accepts both `v0.9` and `v0.9.1` wire versions. Several examples in that
directory still use `v0.9` and the older basic-catalog identity; their fixture
provenance preserves those values.

The processor implements a declared catalog profile. It does **not** claim complete
basic-catalog support or reference-renderer equivalence. Registering a catalog is
not qualification. `supportedCatalogIds` remains empty unless the host explicitly
supplies `qualifiedCatalogIds`; only registered identities can be advertised.

```ts
import {
  A2uiProcessor,
  createA2uiCatalog,
  exportA2uiCatalog
} from '@aceshooting/lyra-gen/adapters/a2ui.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';

const catalog = createA2uiCatalog(initialCatalog);
const processor = new A2uiProcessor({ catalogs: [catalog] });
const catalogDocument = exportA2uiCatalog(catalog);
const result = processor.process({
  version: 'v0.9.1',
  createSurface: { surfaceId: 'answer', catalogId: catalog.id }
}, { ownerId: 'answer-agent' });
```

`createA2uiCatalog` uses reviewed Lyra role names and property schemas under a
version-specific Lyra identity. It does not rename the basic catalog or pretend
that every basic component has an equivalent. Dynamic property bindings, child
lists and event actions use the stable wire shapes. Only bindings declared by the
reviewed view catalog become writable. The exported schema contains no executable
callbacks. Pass the `toView` result through the ordinary view catalog validator
before rendering; that layer enforces child composition, action authorization,
URL sinks and accessible names.

| Capability | Declared behavior |
| --- | --- |
| Lifecycle | Explicit creation before updates; duplicate creation fails; deletion clears all retained state; stable surface IDs may be reused after deletion. |
| Ownership | Every mutation and outbound action checks the host-supplied owner. Catalog and owner are fixed until deletion. |
| Revisions | Processor-wide monotonic revision on every committed create, update, write or delete; revisions never restart when a surface ID is reused; optional compare-and-swap for server updates; mandatory expected revision on user writes and actions. Revisions are host guards, not invented wire fields. |
| Components | Adjacency lists, incremental replacement by ID, forward-reference buffering, root detection, cycle and duplicate rejection. Missing references produce diagnostics. |
| Data | Bounded JSON Pointer upsert, subtree replacement, object-key deletion, sparse array writes and index-preserving array deletion. Relative bindings resolve against template scope; absolute bindings remain absolute. |
| Templates | Nested array templates; identities include component ancestry and data scope. Index-based identity follows the protocol; array reordering does not invent stable item keys. |
| Two-way binding | `writeBinding` updates only a declared writable property on a currently rendered instance, with schema and revision checks. |
| Functions | Explicit catalog registry of pure synchronous functions and declared void host effects. Only pure functions can appear in expressions, checks or arguments. Unknown functions fail. No evaluator, code import or generated function registration. |
| Checks | Boolean conditions are reevaluated against current state; failed checks block outbound actions. Trusted node converters receive `checkErrors` for display. |
| Actions | `createAction` returns native event envelopes. `executeLocalAction` resolves a local `functionCall` in its current instance scope and requires an explicit synchronous host authorization before a pure call or host effect executes. Processing/resolution never executes effects. |
| State metadata | A surface with `sendDataModel` returns its own data-model metadata and owner; the host attaches it only to messages for that owner. Other surfaces are excluded. |
| Bounds | Input and cumulative state budgets, surface/component/expanded-instance limits, pointer index limits, and bounded nesting. Updates resolve successfully before committing. |

Protocol state uses `A2uiDataValue`, separately from `JsonValue`. A deleted array
entry remains an owned `undefined` entry without changing length; a sparse write
preserves gaps. `getSurface` retains both distinctions. JSON views, action context
and transport metadata use a separate projection: undefined array entries and
gaps serialize as null, and undefined object members are omitted, as with native
JSON serialization. The projection never replaces the retained protocol state.

Local actions require the host to register the function and authorize each
invocation. A declaration with `effect: 'host'` and `returnType: 'void'` has no
processor implementation: the authorized host callback performs the effect.
The host owns URL/navigation policy, user-activation requirements and any
confirmation. A pure local action returns its declared result. Missing arguments,
failed checks, stale revisions and policy changes during authorization prevent
execution. Local actions never emit an invented server event. A trusted node
converter must connect `localAction` to this dispatcher; the generic view
converter refuses to silently discard the interaction.

Unregistered functions, unapproved effects, undeclared theme parameters and
undeclared component members fail explicitly. Built-in date-format interpolation,
regex execution, browser navigation and arbitrary standard functions are not
implied by a host-reviewed function registry.

Resolved instance IDs are opaque and scoped to one processor and surface lifetime.
They remain stable while the same source ancestry and scope stay present, but
change after removal or surface deletion and recreation even when the owner,
surface ID and component IDs are reused. Pass the
captured revision back unchanged; do not derive it by counting per-surface updates.
Other surfaces can advance the processor revision sequence. The processor retains
lifetime identities only for active surfaces, with no deleted-surface tombstones.
A host must discard old UI callbacks when replacing the processor itself.

`resolveSurface` retains source component IDs, instance scopes, bindings, checks
and resolved action context. `getSurface` also preserves raw expressions and
component definitions. Consumers must keep that protocol state alongside views;
a view alone cannot replay A2UI semantics. A custom `toNode` converter must preserve
its component's visible behavior and checks. An unresolved root cannot produce a
view.

## Candidate isolation

`@aceshooting/lyra-gen/adapters/a2ui-candidate.js` is a separate opt-in entry point.
It exports a **literal-property catalog artifact** against the pinned candidate
`specification/v1_0/json/catalog_definition.json`. It has a separate Lyra identity,
`protocolVersion: '1.0'`, no functions, and no dynamic expressions or action
contract. There is no candidate message processor. The stable processor rejects
`v1.0` envelopes, and candidate IDs are not included in stable capability metadata.

Candidate schemas differ materially: they introduce `@call`, new function message
operations, an implicit `Surface`, initial data/components, and lifetime-unique
surface identities. Relabeling a stable message would lose those semantics.
Candidate artifacts and tests never count as stable conformance.

## Evidence and maintenance

The fixture cohorts retain exact source URLs, revisions, SHA-256 hashes and the
upstream Apache-2.0 license. Three unmodified examples from the stable directory
exercise text, event actions and scoped child-list templates. Additional normative
cases cover lifecycle, replacement, owner/revision isolation, pointers, nested
scopes, function checks, failures, resource bounds and action metadata. Property
tests cover arbitrary JSON rejection, pointer escaping and incremental replacement.

The authored `test/fixtures/a2ui/extended-report.ts` cohort and
`test/browser/a2ui.test.ts` exercise the owned stable profile through actual chart,
table, stat and citation components: creation, data updates, native keyboard
actions, deletion, stale lifetimes, rejected fields and viewer source revocation.
The fixture uses its own catalog identity. Its trusted citation converter resolves
labels from current viewer-approved metadata and checks access again when the
user activates a source; generated labels grant no access. When viewer policy
changes without a protocol revision, the fixture retires the old view projection
before rendering the newly authorized projection. This scoped rendering
cohort does not qualify every role or the standard basic catalog.

The pinned `client_capabilities.json` describes the capability object's shape and
its A2A metadata placement. `test/a2ui-bindings.test.mjs` adds a bounded consumer
cohort using exact published SDKs: `@ag-ui/client` and `@ag-ui/core` 1.0.3, and
`@a2a-js/sdk` 1.3.0. The fixture provenance records their package integrity values
and the pinned A2UI sources. Tests use real loopback HTTP, SDK serialization and
response consumption; accepted operations reach the report processor.

- **AG-UI 1.0 HTTP/SSE:** the report host reads
  `forwardedProps.a2uiClientCapabilities` after the pinned `RunAgentInputSchema`
  accepts the request. The host validates the exact capability shape and its
  catalog allowlist before returning `a2ui-surface` activity snapshots. This
  metadata location and catalog policy are an explicit host contract. Acceptance
  by AG-UI does not mean its standard middleware negotiates A2UI catalog IDs.
- **A2A 1.0 JSON-RPC:** the pinned client and server carry
  `message.metadata.a2uiClientCapabilities`. This host also requires the exact
  `https://a2ui.org/a2a-extension/a2ui/v0.9.1` URI to be both advertised and
  requested, activates it through the SDK's server context, and returns the
  activation response header. A2A 1.0 uses `A2A-Extensions`; this cohort does not
  qualify the older `X-A2A-Extensions` transport. Explicit activation is a
  requirement of this host profile; the A2UI extension specification permits
  metadata-only negotiation for other hosts.

Both receivers reject malformed capabilities, candidate versions, duplicate IDs,
inline catalogs, unqualified identities and a mixed qualified/unqualified list.
An empty supported list produces no generated surface. A2A also rejects absent,
wrong-version and unadvertised extension activation. Its response fixture uses
array-valued data parts with `metadata.mimeType: "application/a2ui+json"`, following
this pinned extension document's examples; it does not qualify the Python
extension implementation's individual-message data-part behavior.

The stable schema in the pinned `v0_9_1` directory requires the capability key
`v0.9`, which is what `a2uiClientCapabilities()` emits. Some extension-document
examples instead use `v0.9.1`. This cohort follows the actual pinned schema and
rejects that alternate capability key; the surface envelopes and extension URI
still use `v0.9.1`.

These tests enroll only the owned report host and its explicit catalog allowlist.
The package and browser cohort still keep `supportedCatalogIds` empty by default.
Host-provided `qualifiedCatalogIds` remains an explicit host assertion, not a
built-in qualification registry. Requalify a changed catalog, renderer or binding
before advertising its identity in your application.

Full catalog coverage, reference-renderer DOM comparisons, broader AG-UI/A2A
bindings, candidate rendering, and measured bundle/runtime cost remain separate
qualification work.

Maintainers updating the profile must review the pinned official schema and
behavior changes, preserve exact fixture provenance and licenses, rerun the
version-specific cohorts, and requalify every advertised catalog. Do not move
candidate examples into stable results or preserve a qualification assertion
after changing the profile it describes.

## Executable reference comparison

The optional comparison uses a separately provisioned clean upstream checkout at
`409ded29ccac3eebc541979ae5320771703248e8`, with
`typescript/core/web_core/dist` built from that revision, and a built Lyra Gen
package. It does not install dependencies or access the network:

```sh
node scripts/compare-a2ui-reference.mjs --reference <reference-checkout> --output <report.json>
```

The command verifies the upstream revision and clean source tree, records source
and compiled state-module hashes, and compares normative state traces plus the
three official examples through the upstream `MessageProcessor` and
`NodeResolver`. It compares resolved component traversal, text, data and outbound
action fields. This checks the reference renderer's model; browser layout,
accessibility and complete basic-catalog behavior require additional cohorts.

One pinned-source divergence is explicit: the upstream state implementation treats
JSON null as deletion. The stable normative update contract specifies deletion
when `value` is omitted. Lyra retains explicit null; the comparison asserts the
known upstream behavior separately and labels that case as a divergence, never a
match. Changing either behavior makes the corresponding assertion fail.
