# Experimental compatibility and migration

`@aceshooting/lyra-gen` is an independently versioned experimental companion. Its package version,
view format version and catalog version identify different contracts. A package upgrade does not
implicitly upgrade a stored document or grant access to a different catalog.

The initial view format is `version: '1'`. The built-in catalog is `lyra-reviewed` version `1`.
Views carry their catalog reference, surface identity, revision and explicit node identities.
Keep these fields when saving a definition. Reusing an identity for a different logical field can
attach retained user state to the wrong control.

## Upgrades

Pin the experimental package version and use a lockfile. Review its release notes, declared Lyra UI
peer range and exported entry points before upgrading. During the `0.x` period, incompatible
experimental API changes may arrive in a minor release; a patch should preserve the documented
contract. Do not infer stability from the stable Lyra UI APIs the companion uses.

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
choices. Automatic migration of every experimental document is not promised.

## Other contracts

The existing Lyra UI widget document remains `version: '2'`; it is a different contract from a
Lyra Gen view. `lr-widget-renderer` and `lr-gen-view` have separate registries/catalogs, state
properties and action events. Convert deliberately and validate against the destination contract.

`adaptA2UiSurface()` in Lyra UI accepts an A2UI-like structural graph. It is not a native A2UI wire
protocol processor. Protocol processors and adapters must document their exact supported version,
message types and rejected semantics. An imported tree, catalog export or successful example does
not establish full A2UI, AG-UI, MCP Apps or OpenUI conformance.

Server rendering, hydration, remote-code sandboxes, simultaneous collaborative editing and
provider-specific constrained decoding require their own documented support and qualification.
The [roadmap](../../../docs/roadmap/generative-ui.md) records remaining and conditional work;
planned acceptance criteria are not release evidence.

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
  retained. Model quality/cost claims have exact model settings, provider usage and approved-budget
  campaign results. A parser benchmark or fixture replay cannot substitute for those measurements.
- Every advertised protocol version/catalog has its own normative/reference cohort and capability
  limitations. Candidate fixtures do not count toward stable coverage. No complete-conformance
  claim is made for a deliberately restricted host or protocol profile.

The record must link the corresponding raw results and reproduction commands. Until this checklist
is satisfied for a named profile, `0.x` remains the accurate compatibility designation.

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
