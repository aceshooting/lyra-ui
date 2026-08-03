# Project governance

Lyra UI is maintained in public under the MIT license. This document explains who makes project
decisions, which decisions need a written proposal, and where the resulting record lives.

## Roles

- **Users** consume the packages and report bugs, accessibility barriers, and migration problems.
- **Contributors** submit issues, proposals, documentation, tests, or code. A contribution does not
  require prior appointment.
- **Maintainers** review and merge changes, classify component status, manage releases, and apply
  this project's compatibility, security, accessibility, and clean-room rules. The repository's
  [CODEOWNERS](.github/CODEOWNERS) file identifies the current maintainer team.
- **Release managers** are maintainers authorized to approve the protected release environment and
  publish the exact artifact qualified by CI.

Roles describe responsibility, not ownership of a contributor's ideas. Maintainers may delegate a
review or release task without transferring final accountability.

## How decisions are made

Routine fixes and additive work are decided through normal pull-request review. Maintainers seek
technical consensus, using observable behavior, public contracts, tests, package impact, and user
needs as evidence. If consensus is not possible, the maintainers named by CODEOWNERS make the final
decision and record the reason in the issue, pull request, or RFC.

A written RFC is required before implementation when a proposal would:

- add or remove a public component, package, root entry point, optional peer, or design-system
  primitive;
- break or materially narrow a published API, default, event, styling contract, support window, or
  migration guarantee;
- establish a cross-component convention that future contributors must follow; or
- change governance, release authority, security handling, or component-stability policy.

The complete process and proposal template live in [`docs/rfcs/process.md`](docs/rfcs/process.md).
Small bug fixes, documentation corrections, internal refactors, and dependency maintenance do not
need an RFC unless they cross one of the boundaries above.

## Non-negotiable project constraints

No decision may waive the license, clean-room boundary, private vulnerability-reporting path, or
the requirement to describe evidence honestly. In particular:

- public compatibility work may study documented behavior, but must not copy upstream source,
  styles, prose, token values, or brand assets;
- release claims must match automated and recorded evidence; automated accessibility checks are not
  described as assistive-technology testing or human visual review;
- accepted public API changes include tests, documentation, migration/semver analysis, and generated
  artifacts before release; and
- security reports stay private until coordinated disclosure under [`SECURITY.md`](SECURITY.md).

## Releases and component status

Releases use Changesets and semantic versioning. CI qualification is necessary but does not itself
authorize publication: a release manager also verifies that the qualified commit and published
artifact are identical. Component `stable` and `experimental` labels communicate design maturity;
both remain protected by semver after publication. The detailed status and deprecation policy is in
[`packages/lyra-ui/llms/shared.md`](packages/lyra-ui/llms/shared.md).

## Changes to governance

Changes to this document use the RFC process and require approval from CODEOWNERS. The accepted RFC
and the governance edit land together so the decision remains reviewable later.
