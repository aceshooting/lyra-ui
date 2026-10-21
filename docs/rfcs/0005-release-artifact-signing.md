# RFC 0005: Attest source and standalone release assets

- **Status:** Accepted
- **Authors:** Lyra UI maintainers
- **Created:** 2026-10-21
- **Decision:** Approved scope: canonical source and standalone release attestations, 2026-10-21
- **Supersedes / superseded by:** None

## Summary

Extend the existing keyless release attestations to a canonical source archive and every standalone
release payload, while preserving tag-bound workflow execution, exact-commit qualification,
protected environment approval, and byte-verified npm publication.

## Motivation

A package tarball attestation authenticates that tarball. Its source dependency does not sign a source
archive, nor separately downloaded changelogs, custom-elements manifests or LLM references.
Consumers need direct digest and trusted-signer verification for those independent downloads.

## Goals and non-goals

Every new release supplies an attested canonical source archive, its package tarball, CHANGELOG.md,
and, when its package has a manifest generator, custom-elements.json, llms.txt and llms-full.txt.
Unknown or missing release payloads fail verification. Existing qualification gates, signer authority
and environment approvals remain unchanged. Git tag signing, historical tag rewriting, retroactive
attestations through a newer main workflow, and GitHub's automatic source zip/tar archives are excluded.

## Proposed public contract

Add `<package>-<version>-source.tar`, a Git archive of the exact tagged commit with a prefix containing
that commit SHA. The source archive is the canonical signed source distribution. Generated standalone
assets must byte-match their committed versions at the same SHA. Each payload has `.sigstore.json`
and `.intoto.jsonl` sidecars containing the existing keyless Sigstore bundle format. One attestation
may cover multiple payloads; verification must select the actual downloaded payload and expected
workflow identity, tag and signer commit. No runtime component API changes.

## Composition and interaction

The release pack job collects immutable source assets. The shared read-only verifier checks the
complete inventory, reproduces the source archive, compares standalone bytes, and sends additional
assets with a SHA-256 manifest bound to a job output. Protected jobs validate that transfer, recheck
the remote annotated tag, restore and download the exact release assets, then attest the retained
bytes. They never check out or execute source, install dependencies, or extract the source archive.
The existing tarball rebuild and npm publishing path is retained.

## Accessibility, localization, and RTL

Not applicable: this changes developer release artifacts and workflows, without a user interface.

## Platform, security, and packaging

Reuse the pinned attestation action and GitHub OIDC. No keys, dependencies, permissions, approval
settings or trust identities are added. Unknown payloads are rejected, rather than silently omitted
from signing. Sidecars are accepted only for a declared payload. Digest checks authenticate the
transfer manifest before it is parsed; filenames and file types are restricted before use. A final
complete inventory, remote tag, standalone-byte and package digest check precedes bundle publication. A hash alone is not proof of trust:
consumers also verify the certificate issuer, exact workflow/tag identity and signer digest.

## Compatibility and migration

Additive release assets; no package API or dependency change. Existing unsigned GitHub automatic
source archives remain available, explicitly outside the canonical signed distribution. Older tags
retain their existing workflows: dispatching recovery on an old tag cannot activate newer code,
and dispatching it on main remains forbidden. This contract first applies to a future qualified
release commit containing the implementation. Historical releases must not be claimed compliant.

## Alternatives considered

Signing tags alone does not authenticate standalone generated assets. A checksum file alone lacks
trusted-signer verification. A main-based historical signer would change the workflow/source binding
and release authority; it is unnecessary for this extension. Signing arbitrary uploaded bytes would
allow unrelated release assets to acquire trusted provenance without source validation.

## Test, documentation, and rollout plan

Test immutable source authority, complete inventory, missing/extra/tampered bytes, unsafe filenames,
manifest tampering, transfer failures, post-approval mutation and dry-run behavior. Reuse existing
release integrity/workflow tests. Document per-file digest and trusted-signer verification.
After this RFC is accepted and merged, qualify the implementation through the normal required
checks. Only a future qualified release containing it can demonstrate public signatures for all
payloads. Verify every distributed payload and sidecar on that release before claiming full coverage.
No browser/component regeneration is introduced by this release-tooling change.

## Decision

The accepted scope extends the existing automated signing workflow without changing release
authority, approval requirements or historical tags. Publication remains a separate authorized
operation after qualification. Implementation and public artifact verification are pending.
