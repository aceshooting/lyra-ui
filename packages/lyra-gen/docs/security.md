# Security and host authority

Lyra Gen treats model output, imported documents, tool results and restored state as untrusted
input. Its declarative boundary admits catalog roles, schema-checked JSON properties, stable
identities and declared actions. A catalog is trusted application code: review its tags, property
schemas, events and module loaders before making it available to a model.

## Restricted content

Generated content cannot register a custom element, import a module, install an event handler or
evaluate an expression. Lyra Markup is a restricted language, not browser HTML. Text becomes text
nodes; it is not an HTML injection API. Script tags, arbitrary HTML, inline styles, event-handler
properties and prototype-related keys are outside the contract. Do not bypass a rejected result by
passing the same input to `innerHTML`, an HTML viewer or a JavaScript evaluator.

Only properties listed in the active catalog are admitted. Registering a Lyra UI component does
not expose all of its properties to generated content. The reviewed catalog has no URL sinks.
Custom catalogs must declare each URL-bearing property with `urlSinks`; common URL property names
without a declaration are rejected. Arbitrary custom-element property semantics cannot be inferred:
the host must identify every property capable of fetching or displaying remote content, including
properties with nonstandard names. A catalog allowlist alone does not sanitize a remote resource.

The JSON boundary copies and freezes plain data. It rejects accessors, custom prototypes, cycles,
non-finite numbers, sparse arrays, duplicate JSON object keys and prototype-related keys. Limits
bound bytes, nesting, values, string length, arrays, object keys and diagnostics. Host overrides
are clamped to hard ceilings. Keep transport, request-rate and accumulated-session limits in the
host as well: a bounded document does not bound a sequence of requests or an external data source.

## Field collection policy

Collecting roles declare a host-owned `fieldPurpose`: `general`, `password`, `one-time-code`,
`payment-card` or `secret`. The reviewed catalog declares `general`; its input types exclude password
controls. A declared sensitive purpose is refused unless the host approves that exact field for
that surface with `allowSensitive: true`. Native password types and password, OTP and card
`autocomplete` tokens also require the corresponding declared sensitive purpose and approval, including
after a trusted property adapter runs. Generated content
cannot set purpose metadata or provide its own approval registry.

The host supplies `fieldPolicy.approvedFields` entries containing `surfaceId`, the entire reviewed
`node`, its `purpose` and optional `allowSensitive`. Matching is exact: node identity, role, labels,
initial values, child options, bindings and actions must match. Object key order does not matter.
Approval is scoped to the surface and field identity, and is checked again for patches and restored
views. Supply a new catalog when the application's approval changes; a registry does not expire
itself. Catalog subsets retain the collection policy. Approval data is copied and frozen.

Use `requireApprovedFields: true` to reject every unapproved collecting node, including general
text fields. For example, the host can approve one fixed general-purpose field:

```ts
const field = {
  id: 'search', type: 'input',
  props: { label: 'Search terms', type: 'search', value: '' },
  bindings: { value: '/query' },
};
const catalog = createCatalog({
  ...formsCatalog,
  fieldPolicy: {
    requireApprovedFields: true,
    approvedFields: [{ surfaceId: 'search-panel', node: field, purpose: 'general' }],
  },
});
```

For a sensitive workflow, declare a dedicated reviewed role with its sensitive `fieldPurpose`,
then approve its exact node using that same purpose and `allowSensitive: true`. The host must review
the component's actual collection semantics and mark every custom collecting role, even if it has
no local-state bindings. Native input, textarea and select tags and roles with bindings count as
collecting roles even without an explicit purpose; other custom elements are trusted application
code. Prefer a separate host-controlled credential or payment flow, with its own storage and
submission rules. The generic state/snapshot helpers do not redact sensitive values automatically.

These controls do not interpret prose. With the default compatible catalog, a general text label
can still deceptively ask for a password, code or card number. The runtime does not claim to detect
such requests through keywords or model intent. Strict approved fields prevent an unreviewed field
or changed field label; they do not make arbitrary surrounding generated prose trustworthy or stop
a person from typing a secret into an approved general field. Review the whole composition and
keep trusted collection instructions visibly separate from generated explanations. Disable general
collection entirely when the application cannot accept that residual risk.

## URL sinks and navigation

The supported property sink profile is an individual media URL string at a top-level property:

```ts
const images = createCatalog({
  id: 'images', version: '1',
  components: {
    image: {
      tag: 'img',
      properties: { src: { type: 'string' }, alt: { type: 'string' } },
      required: ['src', 'alt'],
      urlSinks: { src: { kind: 'media', origins: ['https://media.example'] } },
    },
  },
});
```

Origins are exact canonical HTTPS origins. Wildcards, credentials, relative URLs, executable/data
schemes and control or bidirectional formatting characters are refused. URL lists, nested URL
schemas and state bindings into sinks are outside this profile. Validation checks supplied values
and the renderer checks final adapted properties before assigning them to an element. The host's
`prepareProperties` callback is trusted executable code; this check catches accidental URL-policy
bypasses but does not sandbox that callback or the custom element. Redirects and resources loaded by
remote content still need the application's CSP, server and component-specific resource policy.
Native media elements can follow redirects outside the initial approved origin; the validator does
not observe their final destination. Use a host-controlled media proxy with redirect validation or
exclude remote media where every network hop must be authorized. An approved origin can receive
URL path/query data and network metadata: grant only origins the
current viewer is allowed to contact, and never interpolate secrets into a URL.

Direct navigation properties such as `href` and `formAction` are refused. Navigation uses an
explicit host action. `validateNavigationDestination(value, { origins })` validates and returns a
canonical HTTPS URL without navigating. The host must display that canonical destination in its
trusted action or confirmation UI, require an actual user gesture at the navigation boundary, and
check the destination again immediately before navigation. A generated button label or synthetic
`lr-gen-action` event is not evidence of a user gesture. The helper grants no user activation and
cannot enforce a host callback's behavior. Opening a new browsing context also requires guarded
`noopener noreferrer` handling. This package does not render a general declarative link component.

## Actions and confirmation

An action name and its payload schema come from the trusted catalog. A generated action carries
`surfaceId`, `nodeId` and `revision` so the host can reject stale context. The view emits
`lr-gen-action`; the application decides whether and how to perform the effect. Rendering a button
does not authorize a tool call, a purchase, publication, navigation or another model request.

Actions marked `confirm` by the catalog require the view's host-supplied `confirmAction` callback
to affirm them. No callback means no approval. The callback receives an `AbortSignal`; cancel the
approval UI when that signal aborts and do not approve a superseded surface. Use an application
confirmation surface such as a configured `lr-confirm-bar` or `lr-tool-approval-dialog`. Generated
labels and action payloads cannot weaken this host policy.

After confirmation, reauthorize the operation at the actual effect boundary. Check the current
user, tenant, permissions, action allowlist and resource revision there. Browser callbacks and
events are not a server security boundary. The server must reject forged, expired or repeated
requests independently. Avoid copying diagnostic messages or arbitrary model text into trusted
confirmation instructions.

## Data and saved documents

Explicit `@data:` and `@tool:` references name entries in host-provided maps. They do not fetch a
URL. A JSON Pointer selects plain data from the authorized entry; inherited and prototype paths
are refused. Missing entries and stale revisions fail rather than acquiring broader authority.
Data resolved from an entry remains literal data, including strings that resemble references.

Populate those maps only after authorizing the current viewer. Sharing a dashboard definition
must not share the creator's session, credentials, raw tool results or permission grants. Recheck
access when reopening, querying, refreshing, exporting and publishing. Clear cached data when a
viewer changes or access is revoked. Scope caches by tenant and authorization context.

The application owns durable storage, identity, access control and publication. Store approved
definitions and selected state separately from credentials, transient handles and pending actions.
Treat imported snapshots as untrusted documents; validate versions, catalog references, bounds and
viewer permissions before mounting them. Restoring a view must never replay its actions.

## Dependencies and telemetry

Lyra Gen contains no model-provider client, analytics collector or telemetry transport. The host
chooses its provider, request transport, logging and telemetry policy. Trusted catalog loaders can
load component modules; host data-source callbacks and action handlers can perform network work.
Review these application capabilities and any optional rendering peers separately. A dependency
inventory is recorded in the [package README](../README.md#dependencies).

The direct runtime and Lit dependency inventory at the current lockfile checkpoint is below.
Versions here identify the reviewed source snapshot; the package metadata and lockfile control
actual installation. Licenses must remain with redistributed code.

| Package | Role | Reviewed version | License |
| --- | --- | --- | --- |
| `lit` | Renderer templates and reactive integration | 3.3.3 | BSD-3-Clause |
| `tslib` | Emitted TypeScript helpers | 2.8.1 | 0BSD |
| `lit-element` | Transitive Lit element implementation | 4.2.2 | BSD-3-Clause |
| `lit-html` | Transitive Lit template implementation | 3.3.3 | BSD-3-Clause |
| `@lit/reactive-element` | Transitive reactive properties | 2.1.2 | BSD-3-Clause |
| `@lit-labs/ssr-dom-shim` | Transitive Lit environment shim | 1.6.0 | BSD-3-Clause |
| `@types/trusted-types` | Transitive type declarations | 2.0.7 | MIT |
| `@aceshooting/lyra-ui` | Required component peer | Peer range in package metadata | MIT |

This table covers the companion's direct dependencies and the resolved Lit closure, not every
optional Lyra UI rendering peer or development tool. Review the repository's lockfile/SBOM and
license checks for that complete graph. Official protocol fixtures are development evidence with
their own retained provenance and license; their presence is not a runtime processor dependency.
The Markup/JSON parsers and A2UI processor are local implementations, not dynamic imports chosen
by generated content.

The [threat matrix](threat-matrix.md) connects these boundaries to named fixtures. Application
callbacks, optional peers and provider retention policies require their own review; this inventory
is not a security certification or a completed network/qualification campaign.
