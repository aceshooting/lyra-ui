# Compatibility and migration

`@aceshooting/lyra-gen` is an independently versioned companion. Its package version,
view format version and catalog version identify different contracts. A package upgrade does not
implicitly upgrade a stored document or grant access to a different catalog.

The initial view format is `version: '1'`. The built-in catalog is `lyra-reviewed` version `1`.
Views carry their catalog reference, surface identity, revision and explicit node identities.
Keep these fields when saving a definition. Reusing an identity for a different logical field can
attach retained user state to the wrong control.

## Supported API boundary

The explicit `exports` map in the installed `package.json` is the import boundary. The package
root and `index.js` expose the same registration-free APIs. Granular paths include the complete
chat, saved/live dashboard, repair, replay and evaluation APIs. Browser registration stays in
`gen-view.js` and `dashboard-binding.js`; the renderer class has its own `gen-view.class.js` entry.
Node must satisfy the package's declared engine, and the installed Lyra UI must satisfy its peer
range. A type-only import of a browser API does not make its runtime server-compatible.

The 1.0 profile covers catalog-bound views, restricted input streams, rendering and state,
chat, repair/replay, and saved/live dashboards through those public entries. It also includes
[static SSR](ssr.md) under its 13-role `lyra-gen-static-v1` profile, the exact
[AI SDK integration](ai-sdk.md), and the owned [A2UI processor and AG-UI/A2A host recipes](a2ui.md).
Those guides define the supported versions, catalogs and rejected semantics; the recipes are
application source, not generic exported transports. Custom catalogs retain host-owned semantics
and authorization. A stable designation requires the [acceptance criteria below](#criteria-for-10).

Only `adapters/a2ui-candidate.js` is separately classified as an experimental artifact API; it does
not export a candidate processor. Its candidate schema and catalog do not expand the supported
processor's capability profile.

The previous wildcard also exposed implementation modules. Replace `catalogs/presets.js` imports
with `catalog.js`; select catalog components through `initialCatalog`, `subsetCatalog()` or the
named presets instead of importing `catalogs/*`. Define custom schemas with the public types or
`typed-catalog.js`, rather than the internal catalog helpers. Import `A2uiDataValue` and
`A2uiDataObject` from `adapters/a2ui.js`; use the processor's state APIs instead of
`adapters/a2ui-state.js`. `localization.js` and `gen-view.styles.js` are internal: use the renderer's
inherited locale/strings properties and documented CSS parts/custom properties. These implementation
paths are no longer exported.

Contributor API checks compare emitted declarations, overloads, public/protected members, module
augmentations and reachable local types against a reviewed baseline. They also check entry points
and registration side-effect metadata. This catches declaration drift; runtime defaults, error
behavior, authorization and cancellation still require their behavioral tests. Updating a snapshot
alone cannot establish compatibility.

## Defaults and ownership

JSON admission uses the following `schema.js` limits. Positive finite overrides are floored to
integers and clamped to the hard ceiling; invalid overrides retain the default.

| Limit | Default | Hard ceiling |
| --- | ---: | ---: |
| `maxBytes` | 1048576 | 4194304 |
| `maxDepth` | 32 | 64 |
| `maxNodes` | 20000 | 100000 |
| `maxStringLength` | 65536 | 262144 |
| `maxArrayLength` | 2000 | 10000 |
| `maxObjectKeys` | 256 | 1024 |
| `maxDiagnostics` | 20 | 100 |

Markup has independent `MARKUP_LIMITS`: 262144 bytes and UTF-16 code units, depth 32, 1000 nodes,
64 attributes per node, JSON depth 32 and 10000 JSON entries. Its overrides accept only positive
safe integers and can only lower those ceilings. Default structural tags are `stack`, `row`,
`grid`, `text`, `heading`, `divider` and `form`; parsing does not authorize a catalog role. Validate
the resulting view against the active catalog. JSON completion defaults to `reject` and never
repairs Markup automatically.

The renderer defaults to `initialCatalog`, empty local binding state and `controlled = false`.
Omitted `enabledActions` permits actions declared by the host catalog; `[]` denies all. Only
catalog actions marked `confirm` require `confirmAction`, and absence of that callback refuses
them. The initial reviewed catalog declares no application actions. Model output never grants
authority. The SDK bridge defaults to empty data/tool selections. Saved instance-state fields and
source parameters require the respective explicit host admission callbacks.

A2UI defaults to 32 surfaces, 2000 components per surface and 5000 expanded instances; overrides
must be positive safe integers. Its advertised catalog list defaults to empty: `qualifiedCatalogIds`
is the host's assertion about exact registered catalogs, not a global certification.

JSON admission returns owned immutable data. `createCatalog()` copies the outer catalog and
component map, retains component definitions, and freezes the resulting definition graph; it is not
a deep-cloning facility for arbitrary host objects. Trusted loaders, adapters, callbacks and host
registries remain host-owned. Do not mutate retained configuration to bypass revision or policy
checks; publish an explicitly supported update or create a new controller.

## Errors and cancellation

Preserve each API's declared result style: untrusted admission uses `LyraGenResult`, parsers and
controllers expose their own status unions, and persistence uses `DashboardError` and
`DashboardConflict`. Invalid trusted configuration may throw `TypeError` or `Error`. Diagnostic
codes and status meanings are machine contracts; explanatory messages are not. Diagnostic `path`
is a JSON Pointer (empty means root), while optional `source.start/end` offsets address original
UTF-16 code units. Handle unknown future diagnostic codes with a safe fallback. Removing or
reassigning an existing code's meaning requires an incompatible-contract review; adding a code must
preserve the documented failure category and admission behavior.

Host exceptions are not uniformly converted. Store/authorization and application callbacks can
reject their callers; query execution/authorization failures become coarse live-data errors,
repair transport failures become diagnostics, and chat suggestion failures become `failed`.
Renderer loader/adapter/confirmation failures use its localized error path. Failure-category
observers cannot interrupt the caller. Never display an arbitrary caught exception as safe user
text; use host-localized messages and retain diagnostic detail separately.

Cancellation invalidates ownership; it does not roll back an external effect:

| Boundary | Cancellation contract |
| --- | --- |
| Markup, JSON and island streams | Stop local admission with their declared terminal result; no provider transport is owned. |
| Chat and renderer confirmation | Abort the supplied host-request signal and reject stale completion; a callback that ignores cancellation may remain pending. |
| Repair and SSR restoration | Race cancellation against pending host work; repair deadlines settle locally, and SSR keeps the static fallback until successful replacement. |
| Live data | Abort execution and invalidate stale results immediately; `refresh()` can remain pending if host authorization/execution ignores cancellation. |
| Dashboard application | Prevent stale mounting and abort the mount signal; context, storage and link-resolution callbacks have no cancellation signal. |
| A2UI local host effects | Authorize before dispatch; execution receives no abort signal, and a started effect cannot be undone. Completion does not grant fresh surface authority. |

## Independent versions

Package SemVer, catalog identity/version, wire protocol, storage revision and renderer revision are
separate. Views, runtime snapshots and replay formats retain string version `'1'`; dashboard
format `lyra-dashboard` and instance state use numeric version `1`. The reviewed catalog remains
`lyra-reviewed` / `'1'`, with its declared roles and the five `chat`, `forms`, `data`, `retrieval`
and `agent-ops` presets. A catalog role, property, default or preset change needs an explicit catalog
compatibility decision even if TypeScript still compiles. Package `1.0.0` does not change these
format values. An SDK or protocol pin change requires qualification of that exact integration;
it does not imply support for all upstream versions or automatic migration of stored content.

## Upgrades

Pin the package version and use a lockfile. Review its release notes, declared Lyra UI peer range
and exported entry points before upgrading. The 1.x compatibility contract preserves documented
public APIs, defaults, diagnostic meanings and admission/cancellation behavior across minor and
patch releases; an incompatible change requires a major release and migration guidance.
The separately experimental `adapters/a2ui-candidate.js` entry may change incompatibly in a minor
release. Earlier 0.x releases used an experimental minor-release compatibility policy; check their
release notes when migrating. Lyra UI's own version does not determine the companion's contract.

For stored content, make upgrades explicit:

1. Retain the original document and catalog/version metadata.
2. Check whether the new application supports that format and catalog.
3. Run an application-approved migration against a copy when a conversion is required.
4. Validate the migrated document and reauthorize its data sources and actions for the viewer.
5. Save a new revision with a conditional write; keep the original available for recovery.

Use [stored-answer migrations](stored-answer-migrations.md) for runtime snapshots and
`migrateDashboard()` for dashboard envelope versions. These are separate contracts; neither
infers compatible catalog versions or automatically authorizes new data access.

An unsupported version or missing catalog needs a visible, localized fallback. Never silently
rename duplicate identities, drop a security-relevant property or reinterpret an unknown action to
make an old document render. Preserve diagnostics for review while giving users safe recovery
choices. Automatic migration of every stored document is not promised.

## Other contracts

The existing Lyra UI widget document remains `version: '2'`; it is a different contract from a
Lyra Gen view. `lr-widget-renderer` and `lr-gen-view` have separate registries/catalogs, state
properties and action events. Convert deliberately and validate against the destination contract.

`adaptA2UiSurface()` in Lyra UI accepts an A2UI-like structural graph. It is not a native A2UI wire
protocol processor. Protocol processors and adapters must document their exact supported version,
message types and rejected semantics. An imported tree, catalog export or successful example does
not establish full A2UI, AG-UI, MCP Apps or OpenUI conformance.

The supported static SSR profile is described above. In-place hydration, remote-code sandboxes,
simultaneous collaborative editing and provider-specific constrained decoding require their own
documented support and qualification.
The [roadmap](../../../docs/roadmap/generative-ui.md) records remaining and conditional work;
planned acceptance criteria are not release evidence.

## Qualification limits

Provider/model quality, schema acceptance, tokens, cost, caching and repair-quality campaigns are
deferred; deterministic fixtures and authored replays do not establish those results. Equivalent
competitor production-build comparisons are also deferred, with no comparative performance claim.
These deferrals do not waive the scoped runtime budgets required below.

Human assistive-technology review has not been performed. Automated keyboard and accessibility
checks are separate evidence. The guided example owns English, French and Arabic copy with Arabic
RTL; that does not establish linguistic review or qualification of every core locale. Its data are
simulated and replies are authored; [website delivery remains separate](guided-demo.md#language-ownership-and-delivery-scope).
Saved-host fixtures use a test adapter and simulated sessions; authentication, service-side
authorization, transactions and deployment remain application responsibilities.

## Criteria for 1.0

A `1.0` designation requires a declared supported profile and a versioned acceptance record for
the exact release candidate. It does not require implementing every conditional roadmap idea.
Before designating that profile stable, all of the following must hold:

- Every included nonconditional acceptance item has implemented behavior, a documented limit and
  passing evidence; there are no unresolved P0 defects in that profile. Excluded and deferred
  items remain explicitly listed rather than counted as support.
- Every catalog role has runtime-validated metadata/examples and populated or open composition
  tests. The complete declared browser workflow passes Chromium, Firefox and WebKit, including
  native forms, focus, cancellation, restore, failures, at least three locales including RTL,
  reduced motion and accessibility checks. Human assistive-technology review is recorded separately.
- The restricted parser corpus contains at least 150 independently named expected cases and seeded
  chunk-boundary/property tests. All supported input routes agree on admitted final semantics,
  and security, identity and resource failures retain explicit rejection behavior.
- Supported stored format/catalog versions have explicit migration or unsupported-version fixtures.
  Saved host workflows demonstrate viewer/editor permissions, tenant separation, revocation,
  conditional-write conflicts, drafts/publications, fork and reopening without generation. A
  test adapter is labeled as such; production host ownership remains documented.
- Public API and action/state type contracts, granular imports, built package examples, CLI and
  bundled agent guidance pass their required checks. Release notes identify any experimental
  entry points that remain outside the stable profile.
- Numerical delivery, main-thread, memory and layout-shift budgets are recorded before measuring
  the candidate; the scoped workloads pass those budgets with environment, samples and uncertainty
  retained. Any model quality/cost claim needs exact model settings, provider usage and approved-budget
  campaign results. A parser benchmark or fixture replay cannot substitute for those measurements.
- Every advertised protocol version/catalog has its own normative/reference cohort and capability
  limitations. Candidate fixtures do not count toward stable coverage. No complete-conformance
  claim is made for a deliberately restricted host or protocol profile.

The record must link the corresponding raw results and reproduction commands. 1.0.0 meets this
checklist except the numerical timing/memory campaign, which follows release. Opt-in region error
isolation is not part of 1.0.

## Criteria for promotion into Lyra UI

Promotion of a companion API or component is a separate ownership decision after qualification;
it is not an automatic consequence of `1.0`. Require a reviewed public API proposal showing a
general reusable need in at least two independent host integration scenarios, an agreed stability
and migration contract, and maintained granular loading without an implicit model/provider client.

The proposed API must pass Lyra UI's normal component, metadata, documentation, localization,
form, accessibility, architecture, browser and release checks. Existing widget-v2 defaults remain
compatible unless an explicitly approved major-release change supplies migration evidence. The
dependency graph must still contain no Lyra UI import of Lyra Gen. Record the measured bundle and
runtime impact and the owner of ongoing compatibility before changing the API's package home.
